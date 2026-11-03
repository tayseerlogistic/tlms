import test from 'node:test';
import assert from 'node:assert/strict';
import {websiteDetails} from '../src/utils/webLinks';
test('website names are preserved and addresses without a scheme use HTTPS',()=>{
 assert.deepEqual(websiteDetails(' Waybill ','5436258.app.netsuite.com/'),{name:'Waybill',url:'https://5436258.app.netsuite.com/'});
 assert.equal(websiteDetails('Bayan','https://logisti.sa/bayan/#/login').url,'https://logisti.sa/bayan/#/login');
});
test('non-web protocols, empty names and credential-bearing links are rejected',()=>{
 for(const [name,url] of [['Bad','javascript:alert(1)'],['Bad','data:text/html,test'],['','https://example.com'],['Bad','https://user:password@example.com']]){
  assert.throws(()=>websiteDetails(name,url));
 }
});
