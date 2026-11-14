import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';

test('new form setup reuses saved resources after a partial failure and rejects an unrelated destination',()=>{
 const values=new Map<string,string>([['nextRow','500']]);
 const counters={sheets:0,forms:0};
 let destination:string|null=null,failLink=true;
 const propertyApi={getProperty:(name:string)=>values.get(name)||null,setProperty:(name:string,value:string)=>values.set(name,value),deleteProperty:(name:string)=>values.delete(name)};
 const sheet={getId:()=> 'new-sheet',setSpreadsheetTimeZone:()=>{}};
 const listItem={getTitle:()=> 'Truck Plate Number',setTitle:()=>listItem,setRequired:()=>listItem,setChoiceValues:()=>listItem};
 let hasPlate=false;
 const form={
  getId:()=> 'new-form',getDestinationId:()=>destination,
  setDestination:(_type:string,id:string)=>{if(failLink)throw Error('Temporary Google failure');destination=id;},
  getItems:()=>hasPlate?[listItem]:[],
  addListItem:()=>{hasPlate=true;return listItem;},
  setDescription:()=>{},setCollectEmail:()=>{},setLimitOneResponsePerUser:()=>{}
 };
 const sandbox:any={
  console,PropertiesService:{getScriptProperties:()=>propertyApi},
  SpreadsheetApp:{create:()=>{counters.sheets++;return sheet;},openById:()=>sheet,flush:()=>{}},
  FormApp:{create:(_name:string,published:boolean)=>{assert.equal(published,true);counters.forms++;return form;},
   openById:()=>form,DestinationType:{SPREADSHEET:'sheet'},ItemType:{LIST:'list'}}
 };
 vm.createContext(sandbox);
 const built=buildSync({entryPoints:['scripts/google-driver-report/Code.js'],bundle:true,write:false,format:'iife',globalName:'Bridge',platform:'neutral',target:'es2022'}).outputFiles[0].text;
 vm.runInContext(built,sandbox);
 const create=sandbox.Bridge.integrationTest.createResources;
 assert.throws(()=>create(),/Temporary Google failure/);
 assert.equal(values.get('systemSheetId'),'new-sheet');
 assert.equal(values.get('newFormId'),'new-form');
 assert.equal(values.has('nextRow'),false);
 failLink=false;
 create();create();
 assert.deepEqual(counters,{sheets:1,forms:1});
 assert.equal(destination,'new-sheet');
 destination='unrelated-sheet';
 assert.throws(()=>create(),/another spreadsheet/);
});
