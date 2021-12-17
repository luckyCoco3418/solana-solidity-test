require("dotenv").config();
const { Connection, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js')
const { Contract, publicKeyToHex } = require('@solana/solidity')
const { readFileSync } = require('fs')

const ERC20_ABI = JSON.parse(readFileSync('./build/ERC20.abi', 'utf8'))
const BUNDLE_SO = readFileSync('./build/bundle.so')

;(async function () {
    console.log('Connecting to your local Solana node ...')
    const connection = new Connection(
        // works only for localhost at the time of writing
        // see https://github.com/solana-labs/solana-solidity.js/issues/8
        process.env.RPC_URL, // 'http://localhost:8899', // "https://api.devnet.solana.com",
        'confirmed'
    )

    const payer = Keypair.generate()
    while (true) {
        console.log('Airdropping (from faucet) SOL to a new wallet ...')
        await connection.requestAirdrop(payer.publicKey, 1 * LAMPORTS_PER_SOL)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        if (await connection.getBalance(payer.publicKey)) break
    }

    const address = publicKeyToHex(payer.publicKey)
    const program = Keypair.generate()
    const storage = Keypair.generate()

    const contract = new Contract(connection, program.publicKey, storage.publicKey, ERC20_ABI, payer)

    console.log('Deploying the Solang-compiled ERC20 program ...')
    await contract.load(program, BUNDLE_SO)

    console.log('Program deployment finished, deploying ERC20 ...')
    await contract.deploy('ERC20', ['MyToken', 'MTO', '1000000000000000000'], program, storage, 4096 * 8)

    console.log('Contract deployment finished, invoking contract functions ...')
    const symbol = await contract.symbol()
    const balance = await contract.balanceOf(address)

    console.log(`ERC20 contract for ${symbol} deployed!`)
    console.log(`Wallet at ${address} has a balance of ${balance}.`)

    contract.addEventListener(function (event) {
        console.log(`${event.name} event emitted!`)
        console.log(
            `${event.args[0]} sent ${event.args[2]} tokens to
       ${event.args[1]}`
        )
    })

    console.log('Sending tokens will emit a "Transfer" event ...')
    const recipient = Keypair.generate()
    await contract.transfer(publicKeyToHex(recipient.publicKey), '1000000000000000000')

    process.exit(0)
})()
