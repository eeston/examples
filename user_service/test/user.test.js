import test from 'ava'
import path from 'path'
import caller from 'grpc-caller'
import sprom from 'sprom'

import User from '../user'

const users = require('../user_db.json')

const PROTO_PATH = path.resolve(__dirname, '../../protos/user.proto')
const HOSTPORT = '0.0.0.0:50051'
const client = caller(HOSTPORT, PROTO_PATH, 'UserService')

test('fail with wrong auth info', async t => {
  t.plan(5)
  const err = await t.throwsAsync(client.getUser({ id: '1d78202b-23cf-4d1e-92ac-2d2f76278a7d' }, { apikey: '654321' }))
  t.truthy(err)
  t.is(err.message, '16 UNAUTHENTICATED: Not Authorized')
  const md = err.metadata.getMap()
  t.is(md.type, 'AUTH')
  t.is(md.code, 'INVALID_APIKEY')
})

test('fail with wrong api key', async t => {
  t.plan(5)
  const err = await t.throwsAsync(client.getUser({ id: '1d78202b-23cf-4d1e-92ac-2d2f76278a7d' }, { Authorization: 'apikey 654322' }))
  t.truthy(err)
  t.is(err.message, '16 UNAUTHENTICATED: Not Authorized')
  const md = err.metadata.getMap()
  t.is(md.type, 'AUTH')
  t.is(md.code, 'INVALID_APIKEY')
})

test('get existing user', async t => {
  t.plan(2)
  const response = await client.getUser({ id: '1d78202b-23cf-4d1e-92ac-2d2f76278a7d' }, { Authorization: 'apikey 654321' })
  t.truthy(response)
  const user = new User(response)
  t.deepEqual(user.metadata, {
    foo: 'bar',
    active: true
  })
})

test('get all users', async t => {
  const nusers = users.length
  t.plan(nusers + 1)
  // need to set empty object for "query" arg / param
  const call = client.listUsers({}, { Authorization: 'apikey 654321' })
  let counter = 0
  call.on('data', (data) => {
    const u = new User(data)
    t.truthy(u.id)
    counter++
  })

  await sprom(call)
  t.is(counter, nusers)
})

test('create user', async t => {
  t.plan(5)
  const data = {
    email: 'test@test.com',
    dateOfBirth: new Date('1/1/2000').toISOString(),
    password: 's3crE+1',
    metadata: new Buffer(JSON.stringify({foo: 'bar'}))
  }

  const ret = await client.createUser(data, { Authorization: 'apikey 654321' })
  t.truthy(ret)
  t.truthy(ret.id)
  const r = new User(ret)
  t.truthy(r.metadata)
  t.truthy(r.metadata.foo)
  t.is(r.metadata.foo, 'bar')
})
