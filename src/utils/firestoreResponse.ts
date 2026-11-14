/** Firestore streaming REST methods return errors inside an array. */
export function parseFirestoreResponse(status: number, body: string) {
 let data: any;
 try { data = JSON.parse(body); }
 catch { throw new Error('Firestore HTTP '+status+': Google returned a non-JSON response.'); }
 const failure = Array.isArray(data) ? data.find(item=>item?.error)?.error : data?.error;
 if (status>=300 || failure) {
  throw new Error('Firestore HTTP '+status+' '+(failure?.status || '')+': '+(failure?.message || 'No error details returned.'));
 }
 return data;
}
