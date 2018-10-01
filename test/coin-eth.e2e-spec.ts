import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { connect, Connection } from 'amqplib';
import fs from 'fs';
import 'jest';
import * as schedule from 'nest-schedule';
import signature from 'superagent-http-signature';
import request from 'supertest';
import Web3 from 'web3';
import { ConfigService } from '../src/config/config.service';
import { CronModule } from '../src/crons/cron.module';
import { HttpModule } from '../src/http/http.module';

describe('ETH (e2e)', () => {
  let app: INestApplication;
  let amqpConnection: Connection;
  let web3: Web3;
  const signer = signature({
    algorithm: 'rsa-sha256',
    headers: ['(request-target)', 'date', 'content-md5'],
    key: fs.readFileSync(__dirname + '/fixtures/private.pem', 'ascii'),
    keyId: '/test/keys/1a:2b',
  });

  beforeAll(async () => {
    schedule.defaults.enable = false;
    app = (await Test.createTestingModule({
      imports: [HttpModule, CronModule],
    }).compile()).createNestApplication();
    await app.init();
    // prepare AMQP
    amqpConnection = await connect(app.get(ConfigService).amqp);
    // prepare Web3
    web3 = app.get(Web3);
  });

  it('GET /coins', (done) => {
    request(app.getHttpServer())
      .get('/coins?coinSymbol=ETH')
      .use(signer)
      .expect(200)
      .end((err, res) => {
        if (err) {
          done.fail(err);
        }
        expect(res.body.chain).toStrictEqual('ethereum');
        expect(res.body.symbol).toStrictEqual('ETH');
        expect(res.body.depositFeeSymbol).toStrictEqual('ETH');
        expect(res.body.withdrawalFeeSymbol).toStrictEqual('ETH');
        done();
      });
  });

  it('GET /addrs', (done) => {
    request(app.getHttpServer())
      .get('/addrs?coinSymbol=ETH&path=1')
      .use(signer)
      .expect(200, '0x577E5592a9DE963f1DC0260bC6EB58f6eAbAA1BD', done);
  });

  afterAll(async () => {
    await amqpConnection.close();
    await app.close();
  });
});