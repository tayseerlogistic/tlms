export type UserRole = 'admin' | 'dispatcher' | 'operator' | 'editor' | 'cashier' | 'driver' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status?: 'active' | 'suspended';
  driverId?: string; // If mapped to one of the fleet drivers
  driverName?: string;
  notes?: string;
  password?: string; // Stored credential for provisioned accounts
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface Truck {
  id: string;
  seq: number;
  plate: string;
  plateNorm: string;
  type: string;
  description: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'STANDBY' | 'OUT_OF_SERVICE';
  istemaraExp?: string;
  insuranceExp?: string;
  fahasExp?: string;
  assignedDriverId?: string | null;
  assignedDriverName?: string | null;
  assignedEquipmentId?: string | null;
  notes?: string;
}

export interface Equipment {
  id: string;
  seq: number;
  equipNo: string;
  equipNorm: string;
  type: 'Tanker' | 'Flatbed' | 'Dumber';
  status: 'ACTIVE' | 'MAINTENANCE' | 'STANDBY';
  assignedTruckId?: string | null;
  assignedTruckPlate?: string | null;
  active: boolean;
}

export interface Driver {
  id: string;
  seq: number;
  name: string;
  nameNorm: string;
  empNo: string;
  iqama: string;
  iqamaExp?: string;
  nationality: string;
  mobile: string;
  transporter: string;
  workingFor: string;
  status: 'AVAILABLE' | 'ON_TRIP' | 'VACATION' | 'MAINTENANCE' | 'INCOMPLETE';
  assignedTruckId?: string | null;
  assignedVehiclePlate?: string | null;
  equipment?: string;
  cardExp?: string;
  active: boolean;
  notes?: string;
  history?: Record<string, string>; // date -> tag
}

export interface Commodity {
  id: string;
  canonical: string;
  shortForm: string;
  aliases: string[];
  jumboBagMT: number | null;
  defaultPackaging: string;
  hazardClass?: string | null;
}

export interface StoreMapItem {
  id: string;
  key: string;
  destination: string;
  storeName: string;
  customer: string;
  region: string;
}

export interface TimetableRow {
  id: string;
  driverName: string;
  iqama: string;
  mobile: string;
  equipmentNo: string;
  plateNo: string;
  source: string;
  destination: string;
  customer: string;
  supplier: string;
  store: string;
  equipmentType: string;
  commodity: string;
  waybill: string;
  dn: string;
  transporter: string;
  notes: string;
  bayanExpiry: string;
  priority?: number;
}

export interface DailySchedule {
  date: string;
  rows: TimetableRow[];
  confirmed?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface DailyManifest {
  date: string;
  tags: Record<string, string>;
  confirmedAt?: string;
  confirmedBy?: string;
  driverCount?: number;
}

export interface ManifestSuggestion {
  text: string;
  conf: 'high' | 'medium' | 'low';
  reason: string;
}

export interface LearnedRule {
  driverIndex: number;
  driverName: string;
  keys: string[];
  result: string;
  hits: number;
  lastSeen: string;
}

export interface CashTransaction {
  id: string;
  date: string;
  dateISO: string;
  account: string;
  employee: string;
  type: 'Advance Given' | 'Expense Settlement' | 'Advance Returned' | 'Cash In' | 'Income' | 'Transfer In' | 'Transfer Out' | 'Cash Out' | 'Reversal';
  category: string;
  amount: number;
  description: string;
  receipt?: string;
  status: 'Posted' | 'Reversed';
  createdBy?: string;
  createdAt?: string;
  reversalOf?: string;
}

export interface CashAccount {
  id: string;
  name: string;
  opening: number;
  active: boolean;
}

export interface KmRecord {
  id: string;
  date: string;
  veh: string;
  odometer: number | null;
  km: number;
  driver?: string;
  loggedBy?: string;
  notes?: string;
}

export interface DieselLog {
  id: string;
  date: string;
  veh: string;
  drv: string;
  liters: number;
  cost: number;
  route: string;
  loggedBy?: string;
}

export interface DataConflict {
  id: string;
  severity: 'high' | 'medium' | 'low';
  entity: 'truck' | 'driver' | 'kmMonthly';
  entityId: string;
  field: string;
  value: any;
  issue: string;
  status: 'open' | 'resolved';
}
