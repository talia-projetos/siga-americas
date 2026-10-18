// Ícones lineares consistentes. SVG local, sem biblioteca ou requisição externa.
const paths={
  dashboard:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h3m-3 4h3m5-4h1"/>',
  field:'<path d="M3 21V5l9-3 9 3v16l-9-3-9 3Z"/><path d="M12 2v16M3 11l9-3 9 3"/>',
  contract:'<path d="M7 2h7l5 5v14a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v6h5M9 13h6M9 17h6"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M19 14a6 6 0 0 1 3 5v2"/>',
  assets:'<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M2.5 12h19M11 12v3h2v-3"/>',
  supplies:'<path d="M12 2 3 7l9 5 9-5-9-5ZM3 7v10l9 5 9-5V7M12 12v10"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',
  route:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h7"/>',
  repeat:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  log:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  catalog:'<path d="M4 3h16v18H4zM8 3v18M11 8h6M11 12h6M11 16h5"/>',
  shield:'<path d="m12 22 7-4V6l-7-4-7 4v12l7 4Z"/><path d="m9 12 2 2 4-4"/>',
  check:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
  requirements:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 8h10M7 12h10M7 16h6M8 2v4M16 2v4"/>',
  pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  layers:'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  hardhat:'<path d="M3 17h18M5 17V14a7 7 0 0 1 14 0v3M12 7v10M2 20h20"/>',
  hand:'<path d="M8 12V6a2 2 0 0 1 4 0v4-6a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8a7 7 0 0 1-7 7H9a7 7 0 0 1-5-2l-2-3a2 2 0 0 1 3-3l3 2"/>',
  shirt:'<path d="m16 3 5 4-2 5-3-2v11H8V10l-3 2-2-5 5-4a5 5 0 0 0 8 0Z"/>',
  truck:'<path d="M3 7h12v11H3zM15 11h4l3 4v3h-7M7 18a2 2 0 1 0 4 0M17 18a2 2 0 1 0 4 0"/>',
  fuel:'<path d="M4 20h12M6 20V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M8 8h6M16 8l4 4v4a2 2 0 0 1-4 0"/>',
  wrench:'<path d="M20.5 6.5a6 6 0 0 1-7.8 7.8L6 21l-3-3 6.7-6.7a6 6 0 0 1 7.8-7.8l-4 4 3 3 4-4Z"/>',
  file:'<path d="M6 2h8l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z M14 2v6h5M9 13h6M9 17h6"/>',
  repair:'<path d="m9 4 3 3 3-3M12 7v8M7 15h10M4 21h16M6 12l-3 3 3 3M18 12l3 3-3 3"/>',
  boxes:'<path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/>',
  arrows:'<path d="M7 7h14m-4-4 4 4-4 4M17 17H3m4-4-4 4 4 4"/>',
  cart:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 2h3l3 14h13l2-10H5"/>',
  search:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  chevrondown:'<path d="m6 9 6 6 6-6"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M5 19v2h14v-2"/>',
  close:'<path d="m18 6-12 12M6 6l12 12"/>',
  alert:'<path d="m12 3 10 18H2L12 3Z M12 9v4m0 4h.01"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
};
export const moduleIcons={
 inicio:"dashboard",coverage:"target",field_programs:"calendar",field_plan_items:"clipboard",
 field_routine_templates:"repeat",field_routine_records:"log",activity_catalog:"catalog",
 work_orders:"list",service_posts:"pin",contracts:"contract",contract_items:"book",obligations:"check",
 contract_resource_requirements:"requirements",areas:"layers",teams:"people",employees:"user",
 ppe_items:"hardhat",ppe_deliveries:"shield",uniform_deliveries:"shirt",vehicles:"truck",
 fuel_logs:"fuel",equipment:"wrench",responsibility_terms:"file",maintenance:"repair",
 stock_items:"boxes",stock_movements:"arrows",purchases:"cart"
};
export function iconMarkup(key,cssClass="ui-icon"){
 const name=moduleIcons[key]||key, body=paths[name]||paths.dashboard;
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="'+cssClass+'" aria-hidden="true">'+body+'</svg>';
}
