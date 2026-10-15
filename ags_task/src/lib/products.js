// The shop catalog. Prices are in shekels; `memberPrice` is the club price.
export const CATEGORIES = [
  { id: "cpu", label: "Processors" },
  { id: "gpu", label: "Graphics cards" },
  { id: "ram", label: "Memory" },
  { id: "storage", label: "Storage" },
  { id: "motherboard", label: "Motherboards" },
  { id: "psu", label: "Power supplies" },
  { id: "case", label: "Cases" },
  { id: "cooling", label: "Cooling" },
];

export const PRODUCTS = [
  { id: 441201, category: "cpu", brand: "AMD", name: "AMD Ryzen 7 9800X3D processor - 8 cores, AM5, box", price: 1899, memberPrice: 1749, oldPrice: 2149, deal: true },
  { id: 441202, category: "cpu", brand: "Intel", name: "Intel Core Ultra 7 265K processor - 20 cores, LGA1851, box", price: 1499, memberPrice: 1389 },
  { id: 441310, category: "gpu", brand: "NVIDIA", name: "ASUS Prime GeForce RTX 5070 12GB GDDR7 graphics card", price: 2690, memberPrice: 2499, oldPrice: 2990, deal: true },
  { id: 441311, category: "gpu", brand: "AMD", name: "Sapphire Pulse Radeon RX 9070 XT 16GB GDDR6 graphics card", price: 2890, memberPrice: 2729 },
  { id: 441420, category: "ram", brand: "Corsair", name: "Corsair Vengeance 32GB (2x16GB) DDR5 6000MHz CL30 memory kit", price: 459, memberPrice: 419 },
  { id: 441421, category: "ram", brand: "Kingston", name: "Kingston Fury Beast 16GB DDR5 5600MHz memory - black", price: 229, memberPrice: 199 },
  { id: 441530, category: "storage", brand: "Samsung", name: "Samsung 990 Pro 2TB NVMe M.2 PCIe 4.0 SSD", price: 699, memberPrice: 629, oldPrice: 799, deal: true },
  { id: 441531, category: "storage", brand: "WD", name: "WD Black SN850X 1TB NVMe M.2 SSD with heatsink", price: 429, memberPrice: 389 },
  { id: 441640, category: "motherboard", brand: "MSI", name: "MSI MAG B650 Tomahawk WiFi motherboard - AM5, DDR5, ATX", price: 999, memberPrice: 919 },
  { id: 441750, category: "psu", brand: "Corsair", name: "Corsair RM850e 850W 80+ Gold fully modular power supply", price: 549, memberPrice: 499 },
  { id: 441860, category: "case", brand: "NZXT", name: "NZXT H6 Flow mid-tower case - black, tempered glass", price: 469, memberPrice: 429, oldPrice: 529, deal: true },
  { id: 441970, category: "cooling", brand: "Noctua", name: "Noctua NH-D15 G2 dual-tower CPU air cooler", price: 649, memberPrice: 599 },
];
