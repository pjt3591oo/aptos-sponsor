import { Account, Aptos, AptosConfig, Network, Ed25519PrivateKey, AccountAuthenticator, AccountAuthenticatorEd25519 } from "@aptos-labs/ts-sdk";

import { InputViewFunctionData } from "@aptos-labs/ts-sdk";
const network = Network.TESTNET;
const config = new AptosConfig({ network });
const aptosClient = new Aptos(config);

async function getSequenceNumber(address: string | undefined): Promise<number> {
    if (!address) {
        throw new Error("Address is required");
    }

    const payload: InputViewFunctionData = {
        function: `0x1::account::get_sequence_number`,
        functionArguments: [address],
    };

    const sequenceNumber = (
        await aptosClient.view<[number]>({
            payload,
        })
    )[0];

    return sequenceNumber;
}


const fromAccountAddressPrivatekey = '0xd983dee8cf017f4d3bf01efc9b92507621077c36258076c0fa3d118e9ac5c8c7';
const fromAccount = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(fromAccountAddressPrivatekey),
})

const toAccount = Account.generate()

async function main() {
    const accountSequenceNumber = await getSequenceNumber(fromAccount.accountAddress.toString())
    console.log(`from: ${fromAccount.accountAddress.toString()}, to: ${toAccount.accountAddress.toString()}, amount: ${1}`);
    const transaction = await aptosClient.transaction.build.simple({
        sender: fromAccount.accountAddress,
        withFeePayer: true,
        data: {
            function: "0x1::aptos_account::transfer",
            functionArguments: [toAccount.accountAddress, (1).toFixed()],
        },
        options: {
            // maxGasAmount: 1000000,
            // gasUnitPrice: 0,
            expireTimestamp: new Date().getTime() + 10000,
            accountSequenceNumber,
        }
    })

    const senderTransactionSignature = await aptosClient.transaction.sign({
        signer: fromAccount,
        transaction,
    })
    
    const publicKey = (senderTransactionSignature as AccountAuthenticatorEd25519).public_key.toString();
    const signature = (senderTransactionSignature as AccountAuthenticatorEd25519)?.signature.toString();

    const senderSignature = {
      publicKey,
      signature,
    };

    const transactionOptions = {
        maxGasAmount: transaction.rawTransaction.max_gas_amount.toString(),
        gasUnitPrice: transaction.rawTransaction.gas_unit_price.toString(),
        expireTimestamp:
            transaction.rawTransaction.expiration_timestamp_secs.toString(),
        accountSequenceNumber:
            transaction.rawTransaction.sequence_number.toString(),
    };

    const res = await fetch('http://localhost:3000/sponsor', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            transaction: {
                sender: fromAccount.accountAddress.toString(),
                withFeePayer: true,
                data: {
                    function: "0x1::aptos_account::transfer",
                    functionArguments: [toAccount.accountAddress.toString(), (1).toFixed()],
                },
            },
            transactionOptions,
            senderSignature,
        }),
    });
    const data = await res.json();
    console.log(data);
}

main();