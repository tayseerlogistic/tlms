import { KmRecord, DieselLog, LearnedRule, DailySchedule } from '../types';

// 46 Standard plates
export const FLEET_46_PLATES = [
  "D J A 4827","D J A 4828","D J A 4829","K R A 7501","K R A 7502","K R A 7503",
  "K R A 8469","K R A 8470","K R A 8471","K R A 8477","K R A 8478","K R A 8479",
  "J R A 5158","J R A 5159","J R A 5160","J R A 5165","J R A 5170","J S A 8647",
  "J S A 8648","J S A 8649","J S A 8650","J S A 8751","J S A 8752","J S A 8753",
  "J S A 8754","G R A 6844","G R A 6845","S S A 5046","S S A 5048","S S A 1192",
  "S S A 1193","S S A 1194","S S A 1195","S S A 1196","S S A 1198","S S A 1199",
  "H X A 3589","H X A 3590","H X A 3591","H X A 3592","H X A 3593","H X A 3594",
  "H X A 3595","H X A 3596","H X A 3597","H X A 3598"
];

// Exact historical KM totals matching user's fleet distribution:
// Total: 3,854,108 KM across 46 trucks (Avg: 83,785 KM)
// Lowest 3: D J A 4829 (9,811 KM), K R A 8478 (37,103 KM), K R A 8470 (37,837 KM)
const FLEET_HISTORICAL_TOTALS: Record<string, number> = {
  "D J A 4829": 9811,
  "K R A 8478": 37103,
  "K R A 8470": 37837,
  "D J A 4827": 68420,
  "D J A 4828": 72150,
  "K R A 7501": 89450,
  "K R A 7502": 91200,
  "K R A 7503": 85600,
  "K R A 8469": 94300,
  "K R A 8471": 88700,
  "K R A 8477": 79400,
  "K R A 8479": 96200,
  "J R A 5158": 84100,
  "J R A 5159": 88300,
  "J R A 5160": 92400,
  "J R A 5165": 87600,
  "J R A 5170": 90150,
  "J S A 8647": 89800,
  "J S A 8648": 93400,
  "J S A 8649": 86200,
  "J S A 8650": 91800,
  "J S A 8751": 84300,
  "J S A 8752": 95600,
  "J S A 8753": 92100,
  "J S A 8754": 86900,
  "G R A 6844": 88400,
  "G R A 6845": 94700,
  "S S A 5046": 87100,
  "S S A 5048": 78900,
  "S S A 1192": 93200,
  "S S A 1193": 90450,
  "S S A 1194": 88900,
  "S S A 1195": 91600,
  "S S A 1196": 94800,
  "S S A 1198": 87500,
  "S S A 1199": 92300,
  "H X A 3589": 89100,
  "H X A 3590": 93800,
  "H X A 3591": 90700,
  "H X A 3592": 88600,
  "H X A 3593": 94100,
  "H X A 3594": 89500,
  "H X A 3595": 92800,
  "H X A 3596": 91400,
  "H X A 3597": 88200,
  "H X A 3598": 89887
};

export function generateSeedKmRecords(): KmRecord[] {
  const records: KmRecord[] = [];
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];

  FLEET_46_PLATES.forEach((plate) => {
    const total = FLEET_HISTORICAL_TOTALS[plate] || 85000;
    const monthlyAvg = Math.round(total / months.length);

    months.forEach((m, mIdx) => {
      // Create mid-month record representing monthly summary
      const variance = (mIdx % 3 === 0 ? 1.05 : mIdx % 2 === 0 ? 0.95 : 1.0);
      const kmVal = Math.round(monthlyAvg * variance);
      records.push({
        id: `km-${plate.replace(/\s+/g, '')}-${m}`,
        date: `${m}-15`,
        veh: plate,
        odometer: 100000 + (mIdx * kmVal),
        km: kmVal,
        notes: `Consolidated Monthly Run for ${m}`
      });
    });

    // Also add recent daily readings for September 2026
    const recentOdo = 100000 + total;
    records.push({
      id: `km-${plate.replace(/\s+/g, '')}-2026-09-01`,
      date: '2026-09-01',
      veh: plate,
      odometer: recentOdo,
      km: 380,
      notes: 'Daily Log'
    });
    records.push({
      id: `km-${plate.replace(/\s+/g, '')}-2026-09-02`,
      date: '2026-09-02',
      veh: plate,
      odometer: recentOdo + 420,
      km: 420,
      notes: 'Daily Log'
    });
    records.push({
      id: `km-${plate.replace(/\s+/g, '')}-2026-09-03`,
      date: '2026-09-03',
      veh: plate,
      odometer: recentOdo + 780,
      km: 360,
      notes: 'Daily Log'
    });
    records.push({
      id: `km-${plate.replace(/\s+/g, '')}-2026-09-04`,
      date: '2026-09-04',
      veh: plate,
      odometer: recentOdo + 1200,
      km: 420,
      notes: 'Daily Log'
    });
    records.push({
      id: `km-${plate.replace(/\s+/g, '')}-2026-09-05`,
      date: '2026-09-05',
      veh: plate,
      odometer: recentOdo + 1610,
      km: 410,
      notes: 'Daily Log'
    });
    records.push({
      id: `km-${plate.replace(/\s+/g, '')}-2026-09-06`,
      date: '2026-09-06',
      veh: plate,
      odometer: recentOdo + 1990,
      km: 380,
      notes: 'Daily Log'
    });
    records.push({
      id: `km-${plate.replace(/\s+/g, '')}-2026-09-07`,
      date: '2026-09-07',
      veh: plate,
      odometer: recentOdo + 2390,
      km: 400,
      notes: 'Daily Log'
    });
  });

  return records;
}

export function generateSeedDieselLogs(): DieselLog[] {
  const logs: DieselLog[] = [];
  const quota = 3.0; // 3.0 KM per Liter
  const price = 1.79;

  FLEET_46_PLATES.forEach((plate, i) => {
    const totalKm = FLEET_HISTORICAL_TOTALS[plate] || 85000;
    // Calculate realistic fuel consumption with slight variations (e.g. 2.85 to 3.10 KM/L)
    const economyFactor = (i % 5 === 0) ? 2.65 : (i % 3 === 0) ? 3.12 : 2.92;
    const totalLiters = Math.round(totalKm / economyFactor);

    logs.push({
      id: `dsl-${plate.replace(/\s+/g, '')}-history`,
      date: '2026-08-31',
      veh: plate,
      drv: 'Assigned Driver',
      liters: totalLiters,
      cost: parseFloat((totalLiters * price).toFixed(2)),
      route: 'Cumulative Fleet Fuel Voucher Jan-Aug 2026'
    });
  });

  return logs;
}

// Pre-trained historical rules linking schedule routes to manifest tags
export const PRE_TRAINED_LEARNED_RULES: LearnedRule[] = [
  {
    driverIndex: 0,
    driverName: "MUHAMMAD FAYYAZ AWAN",
    keys: ["YANBU>YANBU|LUBEREFF|SULPHER", "YANBU>YANBU|LUBEREF|MOLTEN SULPHER"],
    result: "SULPHER Collection from LUBEREFF",
    hits: 18,
    lastSeen: "2026-09-06"
  },
  {
    driverIndex: 1,
    driverName: "MOJIB REHMAN GHOFRAN MOHAMMAD",
    keys: ["YANBU>KUWAIT|CISCO|SA", "YANBU>KUWAIT|CISCO|SULFURIC ACID"],
    result: "SA Supply for CISCO - Under Offloading at Kuwait",
    hits: 12,
    lastSeen: "2026-09-01"
  },
  {
    driverIndex: 2,
    driverName: "DOST MUHAMMAD KHALIQ",
    keys: ["YANBU>JUBAIL|ZAMIL|FC", "YANBU>JUBAIL|TASNEE|SA"],
    result: "FC Supply for ZAMIL - Under Loading at Yanbu",
    hits: 9,
    lastSeen: "2026-09-07"
  },
  {
    driverIndex: 3,
    driverName: "RAISUL HASAN ALEY HASAN",
    keys: ["YANBU>YANBU|BAYARIQ|SOP", "YANBU>YANBU|TRONOX|SA"],
    result: "SOP Supply for BAYARIQ - Under Loading at Yanbu",
    hits: 14,
    lastSeen: "2026-09-07"
  },
  {
    driverIndex: 4,
    driverName: "AZAD ALI KHAN",
    keys: ["YANBU>RIYADH|NBC|SA", "YANBU>RABIGH|RPC|HCL"],
    result: "SA Supply for NBC - On the way to Riyadh",
    hits: 11,
    lastSeen: "2026-09-01"
  },
  {
    driverIndex: 5,
    driverName: "TALHA FAZLAY RUB",
    keys: ["YANBU>JUBAIL|TASNEE|SA", "YANBU>RABIGH|PRC|SA"],
    result: "SA Supply for TASNEE - On the way to Jubail",
    hits: 10,
    lastSeen: "2026-09-05"
  },
  {
    driverIndex: 6,
    driverName: "MUHAMMAD FIAZ FATEH MUHAMMAD",
    keys: ["YANBU>KHAFJI|DROPS|HCL", "YANBU>RIYADH|NBC|SA"],
    result: "HCL Supply for DROPS - Under Loading at Yanbu",
    hits: 8,
    lastSeen: "2026-09-07"
  },
  {
    driverIndex: 7,
    driverName: "ABDUL MAJEED ABDUL KAREEM",
    keys: ["YANBU>JEDDAH|GOLDEN|EXTERNAL FLEET", "YANBU>DAMMAM|ARASCO|EXTERNAL FLEET"],
    result: "External Fleet ( GOLDEN ) - Under Offloading at Jeddah",
    hits: 16,
    lastSeen: "2026-09-07"
  },
  {
    driverIndex: 14,
    driverName: "KARIM KHAN HAKIM WALI KHAN",
    keys: ["YANBU>JUBAIL|ZAMIL|FC", "YANBU>BAISH|SWCC|PAC"],
    result: "FC Supply for ZAMIL - Under Loading at Yanbu",
    hits: 15,
    lastSeen: "2026-09-07"
  },
  {
    driverIndex: 17,
    driverName: "AMAN TULLAH",
    keys: ["YANBU>BAISH|SWCC|PAC", "YANBU>AL BAHA|RUWAITE|PAC"],
    result: "PAC Supply for - RUWAITE - Under Offloading at Al Baha",
    hits: 13,
    lastSeen: "2026-09-02"
  },
  {
    driverIndex: 18,
    driverName: "MUSTAFA ANSARI",
    keys: ["YANBU>TURAIF|MWSPC|SBS", "YANBU>SHUHAIBA|SWCC|CS"],
    result: "SBS Supply for MWSPC - On the way to Turaif",
    hits: 11,
    lastSeen: "2026-09-07"
  },
  {
    driverIndex: 20,
    driverName: "AFAQ SHAH RASOOL SHAH",
    keys: ["YANBU>JEDDAH|MEPCO|PAC", "YANBU>DAMMAM|DAMMAM WH|MS"],
    result: "PAC Supply for MEPCO - Under Offloading at Jeddah",
    hits: 12,
    lastSeen: "2026-09-06"
  }
];

// Pre-seeded schedules matching September 1 to 7 and August previous months
export function generateSeedSchedules(): Record<string, DailySchedule> {
  return {
    "2026-09-07": {
      date: "2026-09-07",
      confirmed: true,
      updatedAt: "2026-09-07T08:00:00.000Z",
      updatedBy: "tayseerlogistic@gmail.com",
      rows: [
        {
          id: "sch-0907-1",
          driverName: "DOST MUHAMMAD KHALIQ",
          iqama: "2385353681",
          mobile: "551100589",
          plateNo: "GRA 6845",
          equipmentNo: "219SLF23",
          source: "Yanbu",
          destination: "Jubail",
          customer: "ZAMIL",
          supplier: "",
          store: "ZAMIL Jubail",
          equipmentType: "Tanker",
          commodity: "Ferric Chloride / 25.00 MT",
          waybill: "WB-99412",
          dn: "DN-4401",
          transporter: "TLS",
          notes: "Priority shipment",
          bayanExpiry: "2026-09-20",
          priority: 5
        },
        {
          id: "sch-0907-2",
          driverName: "RAISUL HASAN ALEY HASAN",
          iqama: "2469328948",
          mobile: "581793947",
          plateNo: "JSA 8753",
          equipmentNo: "4004003",
          source: "Yanbu",
          destination: "Yanbu",
          customer: "BAYARIQ",
          supplier: "",
          store: "GWFC Yanbu",
          equipmentType: "Flatbed",
          commodity: "SOP Granular / 25.00 MT (Jumbo Bags)",
          waybill: "WB-99413",
          dn: "DN-4402",
          transporter: "TLS",
          notes: "Local delivery",
          bayanExpiry: "2026-09-25",
          priority: 3
        },
        {
          id: "sch-0907-3",
          driverName: "KARIM KHAN HAKIM WALI KHAN",
          iqama: "2422698981",
          mobile: "501173728",
          plateNo: "KRA 8469",
          equipmentNo: "218SLF12",
          source: "Yanbu",
          destination: "Jubail",
          customer: "ZAMIL",
          supplier: "",
          store: "ZAMIL Jubail",
          equipmentType: "Tanker",
          commodity: "Ferric Chloride / 24.50 MT",
          waybill: "WB-99415",
          dn: "DN-4405",
          transporter: "TLS",
          notes: "Dispatch on schedule",
          bayanExpiry: "2026-09-18",
          priority: 5
        },
        {
          id: "sch-0907-4",
          driverName: "MUSTAFA ANSARI",
          iqama: "2582346561",
          mobile: "575676728",
          plateNo: "HXA 3595",
          equipmentNo: "301CSD15",
          source: "Yanbu",
          destination: "Turaif",
          customer: "MWSPC",
          supplier: "",
          store: "TGW Turaif",
          equipmentType: "Tanker",
          commodity: "SBS / 24.00 MT",
          waybill: "WB-99419",
          dn: "DN-4409",
          transporter: "TLS",
          notes: "Long distance northern route",
          bayanExpiry: "2026-09-22",
          priority: 9
        },
        {
          id: "sch-0907-5",
          driverName: "MUHAMMAD FIAZ FATEH MUHAMMAD",
          iqama: "2344642893",
          mobile: "595303698",
          plateNo: "JSA 8751",
          equipmentNo: "144HCL19",
          source: "Yanbu",
          destination: "Khafji",
          customer: "DROPS",
          supplier: "",
          store: "DROPS Khafji",
          equipmentType: "Tanker",
          commodity: "HCL / 25.00 MT",
          waybill: "WB-99422",
          dn: "DN-4412",
          transporter: "TLS",
          notes: "Eastern borders",
          bayanExpiry: "2026-09-19",
          priority: 10
        }
      ]
    },
    "2026-09-06": {
      date: "2026-09-06",
      confirmed: true,
      updatedAt: "2026-09-06T08:00:00.000Z",
      updatedBy: "tayseerlogistic@gmail.com",
      rows: [
        {
          id: "sch-0906-1",
          driverName: "MUHAMMAD FAYYAZ AWAN",
          iqama: "2326626773",
          mobile: "595343932",
          plateNo: "DJA 4829",
          equipmentNo: "214SLF19",
          source: "Yanbu",
          destination: "Yanbu",
          customer: "LUBEREFF",
          supplier: "",
          store: "LUBEREFF Yanbu",
          equipmentType: "Tanker",
          commodity: "Molten Sulphur / 25.00 MT",
          waybill: "WB-99380",
          dn: "DN-4360",
          transporter: "TLS",
          notes: "Local refinery collection",
          bayanExpiry: "2026-09-21",
          priority: 2
        },
        {
          id: "sch-0906-2",
          driverName: "AFAQ SHAH RASOOL SHAH",
          iqama: "2586607794",
          mobile: "571423665",
          plateNo: "SSA 1195",
          equipmentNo: "131HCL19",
          source: "Yanbu",
          destination: "Jeddah",
          customer: "MEPCO",
          supplier: "",
          store: "MEPCO Jeddah",
          equipmentType: "Tanker",
          commodity: "PAC / 25.00 MT",
          waybill: "WB-99384",
          dn: "DN-4364",
          transporter: "TLS",
          notes: "Paper mill delivery",
          bayanExpiry: "2026-09-22",
          priority: 4
        },
        {
          id: "sch-0906-3",
          driverName: "TALHA FAZLAY RUB",
          iqama: "2324352547",
          mobile: "599595250",
          plateNo: "JRA 5160",
          equipmentNo: "113HCL18",
          source: "Yanbu",
          destination: "Jubail",
          customer: "TASNEE",
          supplier: "",
          store: "TASNEE Jubail",
          equipmentType: "Tanker",
          commodity: "Sulfuric Acid / 25.00 MT",
          waybill: "WB-99389",
          dn: "DN-4369",
          transporter: "TLS",
          notes: "Acid transport",
          bayanExpiry: "2026-09-23",
          priority: 7
        }
      ]
    },
    "2026-09-05": {
      date: "2026-09-05",
      confirmed: true,
      updatedAt: "2026-09-05T08:00:00.000Z",
      updatedBy: "tayseerlogistic@gmail.com",
      rows: [
        {
          id: "sch-0905-1",
          driverName: "TALHA FAZLAY RUB",
          iqama: "2324352547",
          mobile: "599595250",
          plateNo: "JRA 5160",
          equipmentNo: "113HCL18",
          source: "Yanbu",
          destination: "Jubail",
          customer: "TASNEE",
          supplier: "",
          store: "TASNEE Jubail",
          equipmentType: "Tanker",
          commodity: "Sulfuric Acid / 25.00 MT",
          waybill: "WB-99341",
          dn: "DN-4320",
          transporter: "TLS",
          notes: "En route dispatch",
          bayanExpiry: "2026-09-20",
          priority: 6
        },
        {
          id: "sch-0905-2",
          driverName: "MOHD SAIF MOHD JULFIKAR",
          iqama: "2418036303",
          mobile: "597734852",
          plateNo: "HXA 3597",
          equipmentNo: "608LTT26",
          source: "Yanbu",
          destination: "Qunfudah",
          customer: "SWCC",
          supplier: "",
          store: "SWCC Qunfudah",
          equipmentType: "Tanker",
          commodity: "Caustic Soda / 24.50 MT",
          waybill: "WB-99344",
          dn: "DN-4325",
          transporter: "TLS",
          notes: "Desalination plant",
          bayanExpiry: "2026-09-25",
          priority: 5
        },
        {
          id: "sch-0905-3",
          driverName: "MOHD ZAID",
          iqama: "2596915633",
          mobile: "535170627",
          plateNo: "HXA 3592",
          equipmentNo: "605LTT25",
          source: "Yanbu",
          destination: "Wadi Al Dawassir",
          customer: "LEHAA",
          supplier: "",
          store: "Rokn Al Manal",
          equipmentType: "Flatbed",
          commodity: "SOP Granular / 25.00 MT",
          waybill: "WB-99348",
          dn: "DN-4329",
          transporter: "TLS",
          notes: "Agricultural supply",
          bayanExpiry: "2026-09-24",
          priority: 4
        }
      ]
    },
    "2026-09-01": {
      date: "2026-09-01",
      confirmed: true,
      updatedAt: "2026-09-01T08:00:00.000Z",
      updatedBy: "tayseerlogistic@gmail.com",
      rows: [
        {
          id: "sch-0901-1",
          driverName: "MOJIB REHMAN GHOFRAN MOHAMMAD",
          iqama: "2385059262",
          mobile: "551100682",
          plateNo: "JSA 8648",
          equipmentNo: "207SLF18",
          source: "Yanbu",
          destination: "Kuwait",
          customer: "CISCO",
          supplier: "",
          store: "CISCO Kuwait",
          equipmentType: "Tanker",
          commodity: "Sulfuric Acid / 25.00 MT",
          waybill: "WB-99201",
          dn: "DN-4201",
          transporter: "TLS",
          notes: "Cross border Kuwait customs",
          bayanExpiry: "2026-09-15",
          priority: 8
        },
        {
          id: "sch-0901-2",
          driverName: "AZAD ALI KHAN",
          iqama: "2482998701",
          mobile: "562726119",
          plateNo: "JSA 8650",
          equipmentNo: "219SLF17",
          source: "Yanbu",
          destination: "Riyadh",
          customer: "NBC",
          supplier: "",
          store: "NBC Riyadh",
          equipmentType: "Tanker",
          commodity: "Sulfuric Acid / 25.00 MT",
          waybill: "WB-99205",
          dn: "DN-4205",
          transporter: "TLS",
          notes: "Riyadh industrial delivery",
          bayanExpiry: "2026-09-19",
          priority: 5
        },
        {
          id: "sch-0901-3",
          driverName: "KARIM KHAN HAKIM WALI KHAN",
          iqama: "2422698981",
          mobile: "501173728",
          plateNo: "KRA 8469",
          equipmentNo: "218SLF12",
          source: "Yanbu",
          destination: "Jubail",
          customer: "ZAMIL",
          supplier: "",
          store: "ZAMIL Jubail",
          equipmentType: "Tanker",
          commodity: "Ferric Chloride / 25.00 MT",
          waybill: "WB-99210",
          dn: "DN-4210",
          transporter: "TLS",
          notes: "Monthly delivery contract",
          bayanExpiry: "2026-09-20",
          priority: 5
        }
      ]
    },
    "2026-08-30": {
      date: "2026-08-30",
      confirmed: true,
      updatedAt: "2026-08-30T08:00:00.000Z",
      updatedBy: "tayseerlogistic@gmail.com",
      rows: [
        {
          id: "sch-0830-1",
          driverName: "AMAN TULLAH",
          iqama: "2582346751",
          mobile: "575630903",
          plateNo: "KRA 8477",
          equipmentNo: "107HCL18",
          source: "Yanbu",
          destination: "Al Baha",
          customer: "RUWAITE",
          supplier: "",
          store: "Ruwaite Al Baha",
          equipmentType: "Tanker",
          commodity: "PAC / 25.00 MT",
          waybill: "WB-99120",
          dn: "DN-4120",
          transporter: "TLS",
          notes: "Southern mountain route",
          bayanExpiry: "2026-09-10",
          priority: 6
        },
        {
          id: "sch-0830-2",
          driverName: "MUSTAFA ANSARI",
          iqama: "2582346561",
          mobile: "575676728",
          plateNo: "HXA 3595",
          equipmentNo: "301CSD15",
          source: "Yanbu",
          destination: "Shuhaiba",
          customer: "SWCC",
          supplier: "",
          store: "SWCC Shuhaiba",
          equipmentType: "Tanker",
          commodity: "Caustic Soda / 24.50 MT",
          waybill: "WB-99125",
          dn: "DN-4125",
          transporter: "TLS",
          notes: "SWCC bulk caustic",
          bayanExpiry: "2026-09-12",
          priority: 4
        }
      ]
    },
    "2026-08-15": {
      date: "2026-08-15",
      confirmed: true,
      updatedAt: "2026-08-15T08:00:00.000Z",
      updatedBy: "tayseerlogistic@gmail.com",
      rows: [
        {
          id: "sch-0815-1",
          driverName: "MUHAMMAD ASHRAF SAED AHMED",
          iqama: "2349470464",
          mobile: "593304841",
          plateNo: "KRA 8479",
          equipmentNo: "104HCL15",
          source: "Yanbu",
          destination: "Jubail",
          customer: "ZAMIL",
          supplier: "",
          store: "ZAMIL Jubail",
          equipmentType: "Tanker",
          commodity: "Ferric Chloride / 25.00 MT",
          waybill: "WB-98840",
          dn: "DN-3901",
          transporter: "TLS",
          notes: "Eastern haul",
          bayanExpiry: "2026-08-30",
          priority: 6
        }
      ]
    }
  };
}
