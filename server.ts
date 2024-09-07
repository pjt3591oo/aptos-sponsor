import { Account, AccountAddress, AccountAuthenticatorEd25519, Aptos, AptosConfig, Ed25519PrivateKey, Ed25519PublicKey, Ed25519Signature, InputGenerateTransactionPayloadData } from "@aptos-labs/ts-sdk";
import { Network } from "aptos";
import express from 'express';

const bodyParser = require('body-parser')

const network = Network.TESTNET;
const config = new AptosConfig({ network });
const aptosClient = new Aptos(config);

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// signer
const feePayerAccountAddressPrivatekey = '0x46ca34fce26ecde683cc0015044a3123a327dfd93b287641319a68fd25b5f810';
const feePayerAccount = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(feePayerAccountAddressPrivatekey),
});

aptosClient.getAccountCoinAmount({
    accountAddress: feePayerAccount.accountAddress,
    coinType: "0x1::aptos_coin::AptosCoin",
}).then((rst) => {
    // 0.5 APT
    if (rst < 50_000_000) {
        console.log("Fund fee payer account: ", feePayerAccount.accountAddress.toString());
        aptosClient.fundAccount({
            accountAddress: feePayerAccount.accountAddress,
            amount: 100_000_000, // 1 APT
        })
    } else {
        console.log("Fee payer account has enough balance", feePayerAccount.accountAddress.toString());
    }
})

type Body = {
    transaction:  {
        sender: string;
        withFeePayer: true;
        data: {
            function: string;
            typeArguments: [];
            functionArguments: [];
        };
    };
    transactionOptions: {
        maxGasAmount: number;
        gasUnitPrice: number;
        expireTimestamp: number;
        accountSequenceNumber: number;
    };
    senderSignature: {
        publicKey: string;
        signature: string;
    };
};

app.post('/sponsor', async (req: any, res: any) => {
    const { transaction, transactionOptions, senderSignature} : Body= req.body;

    const buildTransaction = await aptosClient.transaction.build.simple({
        sender: AccountAddress.from(transaction.sender),
        withFeePayer: true,
        data: transaction.data as InputGenerateTransactionPayloadData,
        options: {
            maxGasAmount: Number(transactionOptions.maxGasAmount),
            gasUnitPrice: Number(transactionOptions.gasUnitPrice),
            expireTimestamp: Number(transactionOptions.expireTimestamp),
            accountSequenceNumber: Number(transactionOptions.accountSequenceNumber),
        },
    });

    const feePayerAuthenticator = aptosClient.transaction.signAsFeePayer({
        signer: feePayerAccount,
        transaction: buildTransaction,
    });

    const senderAuthenticator = new AccountAuthenticatorEd25519(
        new Ed25519PublicKey(senderSignature.publicKey),
        new Ed25519Signature(senderSignature.signature)
    );

    const pedingTxnTxn = await aptosClient.transaction.submit.simple({
        transaction: buildTransaction,
        senderAuthenticator,
        feePayerAuthenticator,
    });

    const rst = await aptosClient.waitForTransaction({
        transactionHash: pedingTxnTxn.hash,
    });

    return res.json({ rst })
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});