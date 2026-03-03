import test from 'tape'
import {RelayPool, encryptDm, decryptDm, calculateId, createDelegation,
	createDelegationEvent, getPublicKey, signDelegationToken,
	signId, verifyEvent} from '../index.js'

const jb55 = "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245"
const damus = "wss://relay.damus.io"
const scsi = "wss://nostr-pub.wellorder.net"
const relays = [damus, scsi]

const PRIVKEY = "81cbdb9c82bcb6067ca96ca0e754bb3d3efd1b813281010e392256c642de1064"
const PUBKEY = "8a5a685420091ae0abef79be1735921b6bab047cc5b2aaefb8f8902dedf117f5"

function create_test_event(value) {
	const created_at = 0
	const kind = 1
	const content = (value ? value : "hi")
	const tags = []

	return {pubkey: PUBKEY, created_at, kind, content, tags}
}

test('get pubkey works', function (t) {
	t.plan(1)
	t.equal(getPublicKey(PRIVKEY), PUBKEY)
});

test('decrypt works', function (t) {
	t.plan(1)
	const dm = {id: "62cfada0ff663ba225b67dd2c089242cdfd2c05107bd3d871cec8cee3dcf8ae2",pubkey: "8a5a685420091ae0abef79be1735921b6bab047cc5b2aaefb8f8902dedf117f5",created_at: 1669439828,kind: 4,tags: [["p","8a5a685420091ae0abef79be1735921b6bab047cc5b2aaefb8f8902dedf117f5"]],content: "01xFLdntA3rg+L1F+mGUug==?iv=P3yubTIbGbB+Nvi2qtsw0A==",sig: "f52a550ff18ca3cedfdf3c108744c7bd3cdde601c5b014ead814967c4bafe5c87735d32f8734a337d6a271b519d29a0fc863141197bdc6253a3a19c7488ebbff"}

	const content = decryptDm(PRIVKEY, dm)
	t.equal(content, "hi")
});

test('encrypt then decrypt works', async function (t) {
	t.plan(1)
	const msg = "hello, world!"
	let dm = {pubkey: PUBKEY, kind: 4, created_at: 1669439828}
	dm.content = encryptDm(PRIVKEY, PUBKEY, msg)
	const decrypted = decryptDm(PRIVKEY, dm)

	t.equal(decrypted, msg)
});

test('create delegate event', async function (t) {
	const publisher_privkey = "d78578125f35cfc39fab89427d4086be1f0db939c393efd311631776a8e5d9ca"
	const publisher_pubkey = "575d3b6f59dcb0595b127d210c1664ed465f819966b70c937cac7a6e91c3f7d0"

	const conditions = "created_at<1669341617&kind=1"
	const delegation = await createDelegation(PRIVKEY, publisher_pubkey, conditions)
	const ev = create_test_event()
	const delegate_ev = await createDelegationEvent(publisher_privkey, ev, delegation)

	t.equal(delegate_ev.pubkey, delegation.publisherPubkey)
})

test('sign delegation token', async function (t) {
	t.plan(1)

	const unsigned_token = 'nostr:delegation:fa11cadbb65d6e81ae4e18a09ab7d784ea87d8b5c18bc81ece76b088fa0d1f5b:kind=1&created_at>1668780345&created_at<1700317277'

	const signed = await signDelegationToken(PRIVKEY, unsigned_token)
	t.equal(signed.length, 128)
})

test('calculate event id', async function (t) {
	t.plan(1)

	const ev = create_test_event()
	const id = await calculateId(ev)

	t.equal(id, "c690044fedd4fb2a7a3c4757f9deb1be4893e81605a5ae9c04f99a189c2810dd");
})

test('verify event', async function (t) {
	t.plan(2)

	const ev = create_test_event()
	ev.id = await calculateId(ev)
	ev.sig = await signId(PRIVKEY, ev.id)

	const verify = await verifyEvent(ev)

	t.true(verify);

	const other = create_test_event('different')
	other.id = await calculateId(other)
	other.sig = await signId(PRIVKEY, other.id)
	other.id = "0000000000000000000000000000000000000000000000000000000000000000"

	const verifyFalse = await verifyEvent(other)

	t.false(verifyFalse);
})

test('connect to multiple works', function (t) {
	t.plan(2)

	const pool = RelayPool(relays)

	pool.on('open', relay => {
		t.equal(true, relay.url === damus || relay.url === scsi, `connected to ${relay.url}`)

		relay.close()
	});
});

test('querying multiple works', function (t) {
	let per_relay = 2
	let expected = per_relay * relays.length

	t.plan(expected)

	let n = 0
	const pool = RelayPool(relays)

	pool.on('open', relay => {
		relay.subscribe("subid", {limit: per_relay, kinds:[1], authors: [jb55]})
	});

	pool.on('eose', relay => {
		relay.close()
	});

	pool.on('event', (relay, sub_id, ev) => {
		t.equal("subid", sub_id, `got event ${++n}/${expected} from ${relay.url}`)
	});
});

test('connection error handling works', function (t) {
	t.plan(3)

	const pool = RelayPool(['ws://adfaskldasdf.example.com'])

	pool.on('error', (relay, e) => {
		t.ok(e.message, `got error: ${e.message}`)
	})
})

test('connection error handling works, no reconnect', function (t) {
	t.plan(1)

	const pool = RelayPool(['ws://adfaskldasdf.example.com'], {reconnect:false})

	pool.on('error', (relay, e) => {
		t.ok(e.message, `got error: ${e.message}`)
	})
})
