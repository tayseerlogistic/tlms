import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFirestoreResponse} from '../src/utils/firestoreResponse';
test('Firestore error arrays expose Google status and explanation',()=>{
 const error={error:{code:403,status:'PERMISSION_DENIED',message:'Caller lacks database access.'}};
 for(const body of [error,[error]]){
  assert.throws(()=>parseFirestoreResponse(403,JSON.stringify(body)),/HTTP 403 PERMISSION_DENIED: Caller lacks database access/);
 }
 assert.throws(()=>parseFirestoreResponse(503,'<html>Unavailable</html>'),/HTTP 503.*non-JSON/);
 assert.deepEqual(parseFirestoreResponse(200,'[{"readTime":"now"}]'),[{readTime:'now'}]);
});
