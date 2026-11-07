import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMailOrder,schedulePriority} from '../src/utils/timetableEngine';
test('email markdown and merged material cells preserve quantities and destinations',()=>{
 const text=`| Tentative Loading Schedule 06-11-2026 |
| Material | Number of Trucks | Equipped with | Packing | Weight [kg] | Customer | Source | Destination | Requirements |
| :---: | --- |
| Caustic Soda | 2 | Tanker | Bulk | 21500 | Petro Rabigh Utility | TLS | Rabigh | |
| Ferric Chloride | 1 | Tanker | Bulk | 21500 | SWA | Yanbu | Jubail | |
| | 1 | Tanker | Bulk | 21500 | SWA | Yanbu | Al Khobar | Air system |
| 1 | Tanker | Bulk | 21500 | SWA | Yanbu | Ras Al Khair | |
| Internal Transfer | 2 | Flatbed | 25 kg bag | 30,000 | Caustic Soda Flakes | TLS | TPF | |
| 1 | Flatbed | 25 kg bag | 25000 | Magnisium Sulfate | TPF | TLS | |`;
 const result=parseMailOrder(text,[],{});
 assert.equal(result.date,'2026-11-06');
 assert.equal(result.rows.length,8);
 assert.equal(result.rows[0].commodity,'CS / 21.5 MT');
 assert.equal(result.rows[3].destination,'Al Khobar');
 assert.equal(result.rows[3].notes,'Air system');
 assert.equal(result.rows[4].commodity,'FC / 21.5 MT');
 assert.equal(result.rows[5].commodity,'Caustic Soda Flakes / 25 Kg Bags / 1200 Bags / 30 MT');
 assert.equal(result.rows[7].commodity,'Magnesium Sulphate / 25 Kg Bags / 1000 Bags / 25 MT');
});
test('priority follows the requested customer-specific sequence',()=>{
 assert.equal(schedulePriority({customer:'LUBEREF'}),1);
 assert.equal(schedulePriority({supplier:'LUBEREF'}),1);
 assert.equal(schedulePriority({customer:'TRONOX',commodity:'CS / 25 MT'}),2);
 assert.equal(schedulePriority({supplier:'TRONOX',commodity:'CS / 25 MT'}),4);
 assert.equal(schedulePriority({source:'TLS',destination:'TPF',commodity:'SOP'}),3);
 ['CS','FC','PAC','AS','SMBS','SBS','HCL','SA'].forEach((commodity,i)=>assert.equal(schedulePriority({commodity}),i+4));
});
