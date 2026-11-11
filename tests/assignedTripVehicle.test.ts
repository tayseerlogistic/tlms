import assert from 'node:assert/strict';
import test from 'node:test';
import type { Truck, Equipment } from '../src/types';
import { assignedTripVehicle } from '../src/utils/timetableEngine';

const driver = { id: 'driver1', assignedTruckId: 'truck1' };
const truck: Truck = { id: 'truck1', plate: 'DJA 4827', plateNorm: 'DJA4827',
  seq: 1, description: '', type: 'Tanker', status: 'ACTIVE' };
const unit: Equipment = { id: 'e1', seq: 1, equipNo: '4004006', equipNorm: '4004006',
  type: 'Flatbed', status: 'ACTIVE', active: true, assignedTruckId: truck.id };

test('driver selection returns the master plate, unit number and linked equipment type', () => {
  assert.deepEqual(assignedTripVehicle(driver, [truck], [unit]), {
    truckId: truck.id, plateNo: truck.plate, equipmentNo: unit.equipNo, equipmentType: unit.type
  });
});
test('reverse links and unique legacy plates work without equipment records', () => {
  assert.equal(assignedTripVehicle({id: driver.id}, [{...truck, assignedDriverId: driver.id}], [])?.plateNo, truck.plate);
  assert.equal(assignedTripVehicle({id: driver.id, assignedVehiclePlate: 'DJA4827'}, [truck], [])?.truckId, truck.id);
});
test('unassigned, archived and conflicting truck records require manual selection', () => {
  assert.equal(assignedTripVehicle({id: driver.id}, [truck], []), null);
  assert.equal(assignedTripVehicle(driver, [{...truck, archived: true}], []), null);
  assert.equal(assignedTripVehicle(driver, [{...truck, assignedDriverId: 'other'}], []), null);
  assert.equal(assignedTripVehicle(driver, [truck, {...truck, id: 'other', assignedDriverId: driver.id}], []), null);
});
