import test from 'node:test';
import assert from 'node:assert/strict';
import { customerVehicleClass } from './customer-vehicle-class';

const p=(vehicleClass?:string)=>({vehicleClass}) as never;

test('White Label parity vehicle class projection keeps the same four customer buckets',()=>{
  assert.equal(customerVehicleClass(p('중형 SUV')),'SUV');
  assert.equal(customerVehicleClass(p('대형 MPV')),'승합');
  assert.equal(customerVehicleClass(p('준중형 세단')),'승용');
  assert.equal(customerVehicleClass(p('소형 픽업')),'화물·픽업');
});

test('ambiguous or missing vehicle class is not guessed',()=>{
  assert.equal(customerVehicleClass(p('경형')),'');
  assert.equal(customerVehicleClass(p(undefined)),'');
});
