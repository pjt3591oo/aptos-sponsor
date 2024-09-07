import { Account, AccountAddress, Aptos, AptosConfig, Network, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const network = Network.TESTNET;
const config = new AptosConfig({ network });
const client = new Aptos(config);

const balance = async (accountAddress: AccountAddress, versionToWaitFor?: number) => {
    const balance = await client.getAccountAPTAmount({
        accountAddress,
        minimumLedgerVersion: versionToWaitFor
    });

    return balance;
}

const fromAccount = Account.generate()
const feePayerAccount = Account.generate()

const toAccount = Account.generate()

console.log('from account address: ', fromAccount.accountAddress.toString());
console.log('fee payer account account address: ', feePayerAccount.accountAddress.toString());
console.log('to account address: ', toAccount.accountAddress.toString());

async function main() {
    await client.fundAccount({
        accountAddress: fromAccount.accountAddress,
        amount: 100_000_000_000,
    })
    await client.fundAccount({
        accountAddress: feePayerAccount.accountAddress,
        amount: 100_000_000_000,
    })

    const beforeFromAmount = await balance(fromAccount.accountAddress);
    const beforeToAmount = await balance(toAccount.accountAddress);
    const beforeFeePayerAmount = await balance(feePayerAccount.accountAddress);

    const transaction = await client.transaction.build.simple({
        sender: fromAccount.accountAddress,
        withFeePayer: true,
        data: {
            function: "0x1::aptos_account::transfer",
            functionArguments: [toAccount.accountAddress, (1).toFixed()],
        },
        options: {
            maxGasAmount: 1000000,
            gasUnitPrice: 0,
            expireTimestamp: 123,
            accountSequenceNumber: 0,
        }
    })

    const senderSignature = await client.transaction.sign({
        signer: fromAccount,
        transaction,
    });

    const sponsorSignature = await client.transaction.signAsFeePayer({
        signer: feePayerAccount,
        transaction,
    });

    const pendingTxn = await client.transaction.submit.simple({
        transaction,
        senderAuthenticator: senderSignature,
        feePayerAuthenticator: sponsorSignature,
    });

    const committed = await client.waitForTransaction({
        transactionHash: pendingTxn.hash,
    });

    const afterFromAmount = await balance(fromAccount.accountAddress);
    const afterToAmount = await balance(toAccount.accountAddress);
    const afterFeePayerAmount = await balance(feePayerAccount.accountAddress);

    console.log('>>>>>>> before <<<<<<<<');
    console.log('before fromAmount: ', beforeFromAmount);
    console.log('before toAmount: ', beforeToAmount);
    console.log('before feePayerAmount: ', beforeFeePayerAmount);

    console.log('>>>>>>> after <<<<<<<<');
    console.log('after fromAmount: ', afterFromAmount);
    console.log('after toAmount: ', afterToAmount);
    console.log('after feePayerAmount: ', afterFeePayerAmount);
}

main();