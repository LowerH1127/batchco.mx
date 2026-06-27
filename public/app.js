const WHATSAPP_NUMBER = '524495460892';
const STORAGE_KEY_CART = 'batchco_cart';
const STORAGE_KEY_MAPPING = 'batchco_column_mapping';
const IMAGE_FOLDER = 'productos';
const BRAND_ALL = 'TODAS';
const CATEGORY_TABS = ['TODOS', 'HOMBRE', 'MUJER', 'UNISEX', 'TESTERS', 'SETS', 'INFANTIL'];

let ALL_PRODUCTS_CACHE = [];
let RAW_EXCEL_ROWS = [];
let RAW_HEADER_KEYS = [];
let FILTERED_CACHE = [];
let CART = [];
let currentPage = 1;
let currentCategoryFilter = 'TODOS';
let currentBrandFilter = BRAND_ALL;
let selectedDirectoryBrands = [];
let currentView = 'CATALOGO';
let currentColumnMapping = {
  sku: 'SKU',
  description: 'DESCRIPCION',
  brand: 'MARCA',
  price: 'MAYOREO',
  stock: 'EXISTENCIA'
};

const DOM = {
  excelInput: document.getElementById('excel-input'),
  profitMargin: document.getElementById('profit-margin'),
  searchInput: document.getElementById('search-input'),
  brandSuggestions: document.getElementById('brand-suggestions'),
  searchContainer: document.getElementById('search-container'),
  priceMinInput: document.getElementById('price-min'),
  priceMaxInput: document.getElementById('price-max'),
  productsGrid: document.getElementById('products-grid'),
  noProducts: document.getElementById('no-products'),
  noProductsTitle: document.getElementById('no-products-title'),
  noProductsSub: document.getElementById('no-products-sub'),
  noProductsClearBtn: document.getElementById('no-products-clear-btn'),
  productCount: document.getElementById('product-count'),
  macroTabs: document.getElementById('macro-tabs'),
  sidebarContainer: document.getElementById('sidebar-container'),
  paginationControls: document.getElementById('pagination-controls'),
  pageIndicator: document.getElementById('page-indicator'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  brandsList: document.getElementById('brands-list'),
  brandsDirectory: document.getElementById('brands-directory'),
  brandsDirectoryGrid: document.getElementById('brands-directory-grid'),
  catalogWorkspace: document.getElementById('catalog-workspace'),
  logoLink: document.getElementById('logo-link'),
  heroActionBtn: document.getElementById('hero-action-btn'),
  navColeccionBtn: document.getElementById('nav-coleccion-btn'),
  navDirectorioBtn: document.getElementById('nav-directorio-btn'),
  loadingOverlay: document.getElementById('loading-overlay'),
  toast: document.getElementById('toast'),
  columnMappingPanel: document.getElementById('column-mapping'),
  selectSku: document.getElementById('select-sku'),
  selectDescription: document.getElementById('select-description'),
  selectBrand: document.getElementById('select-brand'),
  selectPrice: document.getElementById('select-price'),
  selectStock: document.getElementById('select-stock'),
  applyMappingBtn: document.getElementById('apply-mapping-btn'),
  directoryFloatBar: document.getElementById('directory-float-bar'),
  directorySelectedCount: document.getElementById('directory-selected-count'),
  applyDirectoryFilterBtn: document.getElementById('apply-directory-filter'),
  recalcPricesBtn: document.getElementById('recalculate-prices-btn'),
  clearFiltersBtn: document.getElementById('clear-filters-btn'),
  adminPanel: document.getElementById('admin-panel'),
  adminPasswordModal: document.getElementById('admin-password-modal'),
  adminPasswordInput: document.getElementById('admin-password-input'),
  adminPasswordError: document.getElementById('admin-password-error'),
  adminPasswordSubmit: document.getElementById('admin-password-submit'),
  adminPasswordCancel: document.getElementById('admin-password-cancel'),
  navManagerBtn: document.getElementById('nav-manager-btn'),
  downloadDataBtn: document.getElementById('download-data-btn'),
  cartClearBtn: document.getElementById('cart-clear-btn')
};

const ITEMS_PER_PAGE = {
  mobile: 15,
  tablet: 20,
  desktop: 30
};

function normalizeText(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function escapeHTML(value = '') {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function sanitizeSku(value = '') {
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function parseStock(value) {
  const text = String(value || '').trim();
  if (!text) return 0;
  if (/^(agotado|no\s+hay|sin\s+existencias)$/i.test(text)) return 0;
  const match = text.replace(/[^0-9]/g, '');
  return match ? parseInt(match, 10) : 0;
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getItemsPerPage() {
  const width = window.innerWidth;
  if (width <= 640) return ITEMS_PER_PAGE.mobile;
  if (width <= 1024) return ITEMS_PER_PAGE.tablet;
  return ITEMS_PER_PAGE.desktop;
}

function showLoading(show) {
  DOM.loadingOverlay.classList.toggle('hidden', !show);
}

let toastTimer;
function showToast(message, duration = 2600) {
  if (!DOM.toast) return;
  clearTimeout(toastTimer);
  DOM.toast.textContent = message;
  DOM.toast.classList.remove('hidden', 'toast-exit');
  DOM.toast.classList.add('toast-enter');
  toastTimer = setTimeout(() => {
    DOM.toast.classList.remove('toast-enter');
    DOM.toast.classList.add('toast-exit');
    toastTimer = setTimeout(() => DOM.toast.classList.add('hidden'), 250);
  }, duration);
}

function debounce(fn, wait = 150) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

function saveCart() {
  localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(CART));
}

function loadSavedCart() {
  const saved = localStorage.getItem(STORAGE_KEY_CART);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) CART = parsed.map(item => ({
      sku: sanitizeSku(item.sku),
      name: item.name || '',
      brand: item.brand || '',
      category: item.category || '',
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 0,
      stock: Number(item.stock) || 0
    })).filter(item => item.quantity > 0);
  } catch {
    CART = [];
  }
}

function getColumnOptions(headers) {
  const normalized = headers.map(key => ({ key, value: normalizeText(key) }));
  return {
    sku: findHeader(normalized, ['sku', 'codigo', 'código', 'clave', 'artículo', 'articulo']),
    description: findHeader(normalized, ['descrip', 'descripcion', 'detalle', 'producto', 'name', 'nombre']),
    brand: findHeader(normalized, ['marca', 'brand', 'house', 'fabricante']),
    price: findHeader(normalized, ['mayoreo', 'mayorista', 'precio', 'price', 'costo']),
    stock: findHeader(normalized, ['exist', 'stock', 'cantidad', 'available', 'disponible'])
  };
}

function findHeader(normalizedHeaders, candidates) {
  for (const candidate of candidates) {
    const hit = normalizedHeaders.find(h => h.value.includes(candidate));
    if (hit) return hit.key;
  }
  return normalizedHeaders[0]?.key || '';
}

function populateMappingSelectors(headers) {
  const selects = [DOM.selectSku, DOM.selectDescription, DOM.selectBrand, DOM.selectPrice, DOM.selectStock];
  const values = [currentColumnMapping.sku, currentColumnMapping.description, currentColumnMapping.brand, currentColumnMapping.price, currentColumnMapping.stock];
  selects.forEach((select, index) => {
    select.innerHTML = headers.map(key => `<option value="${escapeHTML(key)}">${escapeHTML(key)}</option>`).join('');
    if (values[index] && headers.includes(values[index])) {
      select.value = values[index];
    }
  });
}

function readExcelHeaders(rows) {
  const keys = new Set();
  rows.forEach(row => Object.keys(row).forEach(key => { if (key) keys.add(String(key)); }));
  return Array.from(keys);
}

function getSelectedMapping() {
  currentColumnMapping = {
    sku: DOM.selectSku.value || currentColumnMapping.sku,
    description: DOM.selectDescription.value || currentColumnMapping.description,
    brand: DOM.selectBrand.value || currentColumnMapping.brand,
    price: DOM.selectPrice.value || currentColumnMapping.price,
    stock: DOM.selectStock.value || currentColumnMapping.stock
  };
  localStorage.setItem(STORAGE_KEY_MAPPING, JSON.stringify(currentColumnMapping));
}

function loadSavedMapping() {
  const saved = localStorage.getItem(STORAGE_KEY_MAPPING);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      currentColumnMapping = { ...currentColumnMapping, ...parsed };
    }
  } catch {
    // ignore
  }
}

function buildProductObject(row, marginPercent) {
  const rawSku = String(row[currentColumnMapping.sku] || '').trim();
  const sku = sanitizeSku(rawSku);
  const rawName = String(row[currentColumnMapping.description] || '').trim();
  const rawBrand = String(row[currentColumnMapping.brand] || '').trim();
  const rawStock = parseStock(row[currentColumnMapping.stock]);

  let macroCategory = 'UNISEX';
  let displayTag = 'Unisex';
  let name = rawName;

  const normalizedName = normalizeText(rawName);
  if (/^t\.\s*c\b/i.test(rawName)) { macroCategory = 'TESTERS'; displayTag = 'Tester Hombre'; name = rawName.replace(/^T\.\s*C\.?\s*/i, ''); }
  else if (/^t\.\s*d\b/i.test(rawName)) { macroCategory = 'TESTERS'; displayTag = 'Tester Dama'; name = rawName.replace(/^T\.\s*D\.?\s*/i, ''); }
  else if (/^t\.\s*u\b/i.test(rawName)) { macroCategory = 'TESTERS'; displayTag = 'Tester Unisex'; name = rawName.replace(/^T\.\s*U\.?\s*/i, ''); }
  else if (/^set\s+c\b/i.test(rawName)) { macroCategory = 'SETS'; displayTag = 'Set Hombre'; name = rawName.replace(/^SET\s+C\.?\s*/i, ''); }
  else if (/^set\s+d\b/i.test(rawName)) { macroCategory = 'SETS'; displayTag = 'Set Dama'; name = rawName.replace(/^SET\s+D\.?\s*/i, ''); }
  else if (/^set\s+u\b/i.test(rawName)) { macroCategory = 'SETS'; displayTag = 'Set Unisex'; name = rawName.replace(/^SET\s+U\.?\s*/i, ''); }
  else if (/^nino\b/i.test(normalizeText(rawName))) { macroCategory = 'INFANTIL'; displayTag = 'Niño'; name = rawName.replace(/^NIÑO\s*/i, ''); }
  else if (/^nina\b/i.test(normalizeText(rawName))) { macroCategory = 'INFANTIL'; displayTag = 'Niña'; name = rawName.replace(/^NIÑA\s*/i, ''); }
  else if (/^c\b/i.test(rawName)) { macroCategory = 'HOMBRE'; displayTag = 'Hombre'; name = rawName.replace(/^C\.?\s+/, ''); }
  else if (/^d\b/i.test(rawName)) { macroCategory = 'MUJER'; displayTag = 'Mujer'; name = rawName.replace(/^D\.?\s+/, ''); }
  else if (/^u\b/i.test(rawName)) { macroCategory = 'UNISEX'; displayTag = 'Unisex'; name = rawName.replace(/^U\.?\s+/, ''); }

  const rawPrice = String(row[currentColumnMapping.price] || '0').replace(/[^0-9.-]+/g, '');
  const basePrice = Number.parseFloat(rawPrice) || 0;
  const price = Number((basePrice * (1 + marginPercent)).toFixed(2));

  const brand = rawBrand || rawName.split(' ')[0] || 'SIN MARCA';
  const brandNormalized = normalizeText(brand);
  const brandValue = brandNormalized === 'adolfo' ? 'ADOLFO DOMINGUEZ' : brandNormalized === 'acqua' ? 'ACQUA DI PARMA' : brandNormalized === 'paco' ? 'PACO RABANNE' : brand;

  const description = 'Fragancia de alta persistencia molecular y fijación premium en piel. Sus notas equilibradas garantizan una estela sofisticada de larga duración ideal para cualquier estación.';

  return {
    sku,
    name,
    brand: brandValue,
    description,
    category: macroCategory,
    tag: displayTag,
    price,
    basePrice,
    stock: rawStock
  };
}

function processExcelData(marginPercent) {
  ALL_PRODUCTS_CACHE = RAW_EXCEL_ROWS
    .map(row => buildProductObject(row, marginPercent))
    .filter(product => product.sku && product.name);
}

function onExcelUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  showLoading(true);
  const reader = new FileReader();

  reader.onload = (loadEvent) => {
    try {
      const data = new Uint8Array(loadEvent.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      RAW_EXCEL_ROWS = XLSX.utils.sheet_to_json(worksheet, { range: 5, defval: '' });
      RAW_HEADER_KEYS = readExcelHeaders(RAW_EXCEL_ROWS);

      if (!RAW_HEADER_KEYS.length) {
        throw new Error('No se han encontrado columnas válidas en el archivo');
      }

      loadSavedMapping();
      const autoDetected = getColumnOptions(RAW_HEADER_KEYS);
      currentColumnMapping = { ...currentColumnMapping, ...autoDetected };
      populateMappingSelectors(RAW_HEADER_KEYS);
      DOM.columnMappingPanel.classList.remove('hidden');

      const marginPercent = Number.parseFloat(DOM.profitMargin.value || 0) / 100;
      processExcelData(marginPercent);
      currentPage = 1;

      DOM.searchInput.value = '';
      DOM.searchContainer.classList.remove('hidden');
      DOM.macroTabs.classList.remove('hidden');
      DOM.sidebarContainer.classList.remove('hidden');
      DOM.paginationControls.classList.remove('hidden');

      renderBrandsSidebar();
      renderBrandsDirectory();
      executeCombinedFilter();
      showToast('Inventario cargado correctamente');
    } catch (error) {
      console.error('Error procesando el archivo:', error);
      alert('Hubo un problema leyendo el archivo. Asegúrate de que es el formato correcto.');
    } finally {
      showLoading(false);
    }
  };

  reader.readAsArrayBuffer(file);
}

function applyColumnMapping() {
  getSelectedMapping();
  const marginPercent = Number.parseFloat(DOM.profitMargin.value || 0) / 100;
  processExcelData(marginPercent);
  executeCombinedFilter();
  showToast('Mapeo de columnas actualizado');
}

function renderBrandsDirectory() {
  DOM.brandsDirectoryGrid.innerHTML = '';
  selectedDirectoryBrands = [];
  const uniqueBrands = [...new Set(ALL_PRODUCTS_CACHE.map(product => product.brand))]
    .filter(brand => brand && brand !== 'NONE' && brand !== 'UNDEFINED')
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  const fragment = document.createDocumentFragment();
  uniqueBrands.forEach(brand => {
    const card = document.createElement('button');
    card.type = 'button';
    card.dataset.brand = brand;
    card.className = 'brand-dir-card bg-black border border-neutral-900 aspect-square flex flex-col items-center justify-center p-6 cursor-pointer hover:border-amber-500 hover:bg-neutral-950 transition duration-300 group text-left';
    card.innerHTML = `
      <span class="text-neutral-800 text-3xl mb-4 group-hover:text-amber-500 transition">✧</span>
      <h4 class="text-white text-[10px] font-semibold uppercase tracking-[0.2em]">${escapeHTML(brand)}</h4>
    `;
    card.addEventListener('click', () => toggleDirectoryBrand(brand, card));
    fragment.appendChild(card);
  });
  DOM.brandsDirectoryGrid.appendChild(fragment);
  updateDirectoryFloatBar();
}

function toggleDirectoryBrand(brand, cardElement) {
  const index = selectedDirectoryBrands.indexOf(brand);
  if (index > -1) {
    selectedDirectoryBrands.splice(index, 1);
    cardElement.classList.remove('border-amber-500', 'bg-neutral-950');
  } else {
    selectedDirectoryBrands.push(brand);
    cardElement.classList.add('border-amber-500', 'bg-neutral-950');
  }
  updateDirectoryFloatBar();
}

function updateDirectoryFloatBar() {
  if (!DOM.directoryFloatBar || !DOM.directorySelectedCount) return;
  const count = selectedDirectoryBrands.length;
  DOM.directoryFloatBar.classList.toggle('hidden', count === 0);
  DOM.directorySelectedCount.textContent = `${count} marca${count !== 1 ? 's' : ''}`;
}

function applyDirectoryFilter() {
  if (!selectedDirectoryBrands.length) return;
  currentBrandFilter = selectedDirectoryBrands.join(',');
  currentPage = 1;
  document.querySelectorAll('#brands-list button').forEach(button => button.classList.remove('brand-active'));
  switchView('CATALOGO');
  executeCombinedFilter();
  showToast(`Filtrando ${selectedDirectoryBrands.length} marca${selectedDirectoryBrands.length !== 1 ? 's' : ''}`);
}

function renderBrandsSidebar() {
  DOM.brandsList.innerHTML = '';
  const uniqueBrands = [...new Set(ALL_PRODUCTS_CACHE.map(product => product.brand))]
    .filter(brand => brand && brand !== 'NONE' && brand !== 'UNDEFINED')
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  const allLi = document.createElement('button');
  allLi.type = 'button';
  allLi.id = 'brand-TODAS';
  allLi.className = 'text-xs font-medium uppercase tracking-widest cursor-pointer py-1 lg:py-1.5 lg:border-l-2 pl-3 border-transparent text-neutral-500 hover:text-white transition brand-active whitespace-nowrap lg:whitespace-normal';
  allLi.textContent = 'TODAS LAS MARCAS';
  allLi.addEventListener('click', () => filterByBrand(BRAND_ALL));
  DOM.brandsList.appendChild(allLi);

  uniqueBrands.forEach(brand => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `brand-${brand.replace(/\s+/g, '-')}`;
    button.className = 'text-xs font-medium cursor-pointer py-1 lg:py-1.5 lg:border-l-2 pl-3 border-transparent text-neutral-500 hover:text-white transition whitespace-nowrap lg:whitespace-normal';
    button.textContent = brand;
    button.addEventListener('click', () => filterByBrand(brand));
    DOM.brandsList.appendChild(button);
  });
}

function selectBrandFromDirectory(brand) {
  selectedDirectoryBrands = [brand];
  applyDirectoryFilter();
}

function switchView(view) {
  currentView = view;
  const isDirectory = view === 'DIRECTORIO';
  DOM.brandsDirectory.classList.toggle('hidden', !isDirectory);
  DOM.catalogWorkspace.classList.toggle('hidden', isDirectory);
  DOM.sidebarContainer.classList.toggle('hidden', isDirectory);

  DOM.heroActionBtn.textContent = 'Explorar Fragancias';
  DOM.navColeccionBtn.classList.toggle('nav-active', !isDirectory);
  DOM.navDirectorioBtn.classList.toggle('nav-active', isDirectory);

  if (!isDirectory) {
    document.getElementById('coleccion').scrollIntoView({ behavior: 'smooth' });
  }
}

function resetFilters() {
  currentCategoryFilter = 'TODOS';
  currentBrandFilter = BRAND_ALL;
  selectedDirectoryBrands = [];
  currentPage = 1;
  DOM.searchInput.value = '';
  if (DOM.priceMinInput) DOM.priceMinInput.value = '';
  if (DOM.priceMaxInput) DOM.priceMaxInput.value = '';
  CATEGORY_TABS.forEach(tab => {
    const button = document.getElementById(`tab-${tab}`);
    if (button) button.classList.toggle('tab-active', tab === 'TODOS');
  });
  const activeBrand = document.getElementById('brand-TODAS');
  document.querySelectorAll('#brands-list button').forEach(button => button.classList.remove('brand-active'));
  if (activeBrand) activeBrand.classList.add('brand-active');
  executeCombinedFilter();
  showToast('Filtros restablecidos');
}

function fuzzyMatch(search, text) {
  if (!search) return true;
  const words = search.split(/\s+/).filter(w => w.length > 0);
  const targetWords = text.split(/\s+/);
  const textNoSpaces = text.replace(/\s+/g, '');

  return words.every(sw => {
    // 1. Direct substring anywhere in text (with or without spaces)
    if (text.includes(sw) || textNoSpaces.includes(sw)) return true;

    // 2. Any word starts with search (prefix match: "latta" → "lattafa")
    if (targetWords.some(tw => tw.startsWith(sw))) return true;

    // 3. Initials / abbreviation — solo para búsquedas de 2-3 letras en marcas multi-palabra
    //    "CH" → "Carolina Herrera", "JPG" → "Jean Paul Gaultier", "YSL" → "Yves Saint Laurent"
    if (sw.length >= 2 && sw.length <= 3 && targetWords.length >= 2) {
      const initials = targetWords.map(w => w[0] || '').join('');
      if (initials === sw) return true;
    }

    return false;
  });
}

// ── Sugerencias de marca ────────────────────────────────────────────

let SUGGESTIONS_ACTIVE_INDEX = -1;
let ALL_BRANDS_SORTED = [];

function buildBrandList() {
  ALL_BRANDS_SORTED = [];
  const set = new Set();
  for (const p of ALL_PRODUCTS_CACHE) {
    if (p.brand) set.add(p.brand);
  }
  ALL_BRANDS_SORTED = [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

function showBrandSuggestions() {
  if (!DOM.brandSuggestions) return;
  const query = normalizeText(DOM.searchInput.value).trim();
  if (query.length < 1) {
    DOM.brandSuggestions.classList.add('hidden');
    return;
  }
  buildBrandList();
  const matches = ALL_BRANDS_SORTED.filter(b => fuzzyMatch(query, normalizeText(b))).slice(0, 8);
  if (!matches.length) {
    DOM.brandSuggestions.classList.add('hidden');
    return;
  }
  SUGGESTIONS_ACTIVE_INDEX = -1;
  DOM.brandSuggestions.innerHTML = matches.map((b, i) =>
    `<button type="button" data-index="${i}" data-brand="${escapeHTML(b)}"
       class="w-full text-left px-5 py-3 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-amber-400 border-b border-neutral-900 last:border-b-0 transition-colors font-light flex items-center gap-3 suggestion-item">
       <span class="text-[10px] uppercase tracking-widest text-neutral-600 w-8 shrink-0">${b.slice(0, 2)}</span>
       <span>${b}</span>
    </button>`
  ).join('');
  DOM.brandSuggestions.querySelectorAll('.suggestion-item').forEach(btn => {
    btn.addEventListener('click', () => selectSuggestion(btn.dataset.brand));
  });
  DOM.brandSuggestions.classList.remove('hidden');
}

function handleSuggestionsKeyboard(e) {
  if (!DOM.brandSuggestions || DOM.brandSuggestions.classList.contains('hidden')) return;
  const items = DOM.brandSuggestions.querySelectorAll('.suggestion-item');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    SUGGESTIONS_ACTIVE_INDEX = Math.min(SUGGESTIONS_ACTIVE_INDEX + 1, items.length - 1);
    highlightSuggestion(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    SUGGESTIONS_ACTIVE_INDEX = Math.max(SUGGESTIONS_ACTIVE_INDEX - 1, -1);
    highlightSuggestion(items);
  } else if (e.key === 'Enter' && SUGGESTIONS_ACTIVE_INDEX >= 0) {
    e.preventDefault();
    const selected = items[SUGGESTIONS_ACTIVE_INDEX];
    if (selected) selectSuggestion(selected.dataset.brand);
  } else if (e.key === 'Escape') {
    DOM.brandSuggestions.classList.add('hidden');
    SUGGESTIONS_ACTIVE_INDEX = -1;
  }
}

function highlightSuggestion(items) {
  items.forEach((item, i) => {
    item.classList.toggle('bg-neutral-900', i === SUGGESTIONS_ACTIVE_INDEX);
    item.classList.toggle('text-amber-400', i === SUGGESTIONS_ACTIVE_INDEX);
    item.classList.toggle('text-neutral-300', i !== SUGGESTIONS_ACTIVE_INDEX);
  });
}

function selectSuggestion(brand) {
  if (!DOM.brandSuggestions) return;
  DOM.searchInput.value = brand;
  DOM.brandSuggestions.classList.add('hidden');
  SUGGESTIONS_ACTIVE_INDEX = -1;
  currentPage = 1;
  executeCombinedFilter();
  showToast(`Filtrado: ${brand}`);
}

// ─────────────────────────────────────────────────────────────────────

function applyFilters() {
  const searchText = normalizeText(DOM.searchInput.value);
  const category = currentCategoryFilter;
  const brand = currentBrandFilter;
  const brandList = brand === BRAND_ALL ? null : brand.split(',').map(b => b.trim().toUpperCase());
  const priceMin = DOM.priceMinInput ? Number.parseFloat(DOM.priceMinInput.value) || null : null;
  const priceMax = DOM.priceMaxInput ? Number.parseFloat(DOM.priceMaxInput.value) || null : null;

  return ALL_PRODUCTS_CACHE.filter(product => {
    const matchesCat = category === 'TODOS' || product.category === category;
    const matchesBrand = !brandList || brandList.includes(product.brand.toUpperCase());
    const normName = normalizeText(product.name);
    const normSku = normalizeText(product.sku);
    const normBrand = normalizeText(product.brand);
    const matchesText = !searchText || fuzzyMatch(searchText, normName) || fuzzyMatch(searchText, normBrand) || normSku.includes(searchText);
    const matchesPrice = (priceMin === null || product.price >= priceMin) && (priceMax === null || product.price <= priceMax);
    return matchesCat && matchesBrand && matchesText && matchesPrice;
  });
}

function executeCombinedFilter() {
  FILTERED_CACHE = applyFilters();
  renderCurrentPage();
}

function renderCurrentPage() {
  const totalItems = FILTERED_CACHE.length;
  DOM.productCount.textContent = `${totalItems} Fragancias encontradas`;

  if (!totalItems) {
    DOM.productsGrid.innerHTML = '';
    DOM.noProducts.classList.remove('hidden');
    DOM.productsGrid.classList.add('hidden');
    DOM.paginationControls.classList.add('hidden');

    const hasData = ALL_PRODUCTS_CACHE.length > 0;
    const hasActiveFilters = currentCategoryFilter !== 'TODOS' || currentBrandFilter !== BRAND_ALL
      || DOM.searchInput.value.trim() || (DOM.priceMinInput && DOM.priceMinInput.value)
      || (DOM.priceMaxInput && DOM.priceMaxInput.value);

    if (DOM.noProductsTitle) {
      DOM.noProductsTitle.textContent = hasData ? 'Sin resultados' : 'Catálogo sin datos';
    }
    if (DOM.noProductsSub) {
      DOM.noProductsSub.textContent = hasData
        ? 'Ningún producto coincide con los filtros aplicados. Prueba con otros criterios de búsqueda.'
        : 'Accede a la Consola Mánager para cargar el inventario.';
    }
    if (DOM.noProductsClearBtn) {
      DOM.noProductsClearBtn.classList.toggle('hidden', !hasData || !hasActiveFilters);
    }
    return;
  }

  DOM.noProducts.classList.add('hidden');
  DOM.productsGrid.classList.remove('hidden');

  const pageSize = getItemsPerPage();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  currentPage = Math.min(currentPage, totalPages);

  if (totalPages > 1) {
    DOM.paginationControls.classList.remove('hidden');
    DOM.pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    DOM.btnPrev.disabled = currentPage === 1;
    DOM.btnNext.disabled = currentPage === totalPages;
  } else {
    DOM.paginationControls.classList.add('hidden');
  }

  const start = (currentPage - 1) * pageSize;
  const pageProducts = FILTERED_CACHE.slice(start, start + pageSize);
  renderProductGrid(pageProducts);
}

function renderProductGrid(products) {
  DOM.productsGrid.innerHTML = '';
  const fragment = document.createDocumentFragment();

  products.forEach(product => fragment.appendChild(createProductCard(product)));
  DOM.productsGrid.appendChild(fragment);
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'bg-black border border-neutral-900 rounded-none p-6 flex flex-col justify-between hover:border-neutral-700 transition-all duration-200 group';

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'w-full bg-neutral-950 aspect-[4/5] rounded-none mb-5 flex items-center justify-center overflow-hidden border border-neutral-900 relative';

  const img = document.createElement('img');
  img.src = `${IMAGE_FOLDER}/${product.sku}.webp`;
  img.alt = product.name;
  img.loading = 'lazy';
  img.className = 'w-full h-full object-contain p-4 group-hover:scale-105 transition duration-300';
  img.addEventListener('error', () => handleImageFallback(img, product.sku));

  const fallback = document.createElement('div');
  fallback.id = `fallback-${product.sku}`;
  fallback.className = 'absolute inset-0 select-none';
  fallback.style.cssText = 'display:none;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(145deg,#0f0f0f 0%,#1a1a1a 40%,#111111 100%);';
  fallback.innerHTML = `
    <div style="position:absolute;top:0;left:0;width:100%;height:1px;background:linear-gradient(to right,transparent,#404040,transparent);"></div>
    <div style="position:absolute;bottom:0;left:0;width:100%;height:1px;background:linear-gradient(to right,transparent,#404040,transparent);"></div>
    <span style="font-size:3.75rem;font-weight:300;letter-spacing:0.3em;text-transform:uppercase;background:linear-gradient(135deg,#b88a44 0%,#d4a853 50%,#8b6b3d 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">B</span>
    <span style="font-size:8px;letter-spacing:0.4em;text-transform:uppercase;color:#525252;margin-top:0.75rem;">Batch Co.</span>
  `;

  imageWrapper.appendChild(img);
  imageWrapper.appendChild(fallback);

  if (product.stock === 0) {
    const soldOut = document.createElement('span');
    soldOut.className = 'absolute top-4 right-4 bg-red-950/80 text-red-400 border border-red-900 text-[10px] tracking-widest uppercase px-2 py-1';
    soldOut.textContent = 'Agotado';
    imageWrapper.appendChild(soldOut);
  }

  const tag = document.createElement('span');
  tag.className = 'absolute bottom-4 left-4 border border-neutral-800 bg-black text-neutral-400 text-[9px] tracking-widest uppercase px-2 py-0.5';
  tag.textContent = product.tag;
  imageWrapper.appendChild(tag);

  const nameHeading = document.createElement('h4');
  nameHeading.className = 'text-xs font-semibold tracking-wide text-neutral-200 uppercase line-clamp-1';
  nameHeading.textContent = product.name;

  const brandLabel = document.createElement('p');
  brandLabel.className = 'text-[10px] text-amber-500 font-medium uppercase tracking-wider mt-1';
  brandLabel.textContent = product.brand;

  const description = document.createElement('p');
  description.className = 'text-[10px] font-light text-neutral-500 mt-3 line-clamp-2 leading-relaxed min-h-[30px]';
  description.textContent = product.description;

  const bottomInfo = document.createElement('div');
  bottomInfo.className = 'flex items-center justify-between mt-4 pt-3 border-t border-neutral-950';
  bottomInfo.innerHTML = `
    <p class="text-[9px] font-mono text-neutral-600 uppercase">SKU: ${escapeHTML(product.sku)}</p>
    <p class="text-[9px] font-mono text-amber-600 uppercase">Disp: ${escapeHTML(String(product.stock))}</p>
  `;

  const priceRow = document.createElement('div');
  priceRow.className = 'mt-6 pt-4 border-t border-neutral-900 flex items-center justify-between';
  const priceLabel = document.createElement('span');
  priceLabel.className = 'text-white font-medium text-sm tracking-wide';
  priceLabel.textContent = formatMoney(product.price);

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.textContent = '+ Agregar';
  addButton.className = `border border-white bg-white text-black text-[9px] uppercase font-semibold tracking-widest px-3 py-2 hover:bg-black hover:text-white transition duration-200${product.stock === 0 ? ' opacity-30 cursor-not-allowed' : ''}`;
  if (product.stock === 0) addButton.disabled = true;
  addButton.addEventListener('click', () => addToCart(product.sku, product.name, product.price, product.brand, product.category, product.stock));

  priceRow.appendChild(priceLabel);
  priceRow.appendChild(addButton);

  card.appendChild(imageWrapper);
  card.appendChild(nameHeading);
  card.appendChild(brandLabel);
  card.appendChild(description);
  card.appendChild(bottomInfo);
  card.appendChild(priceRow);

  return card;
}

function handleImageFallback(img, sku) {
  img.style.display = 'none';
  const fallback = document.getElementById(`fallback-${sku}`);
  if (fallback) fallback.style.display = 'flex';
}

function addToCart(sku, name, price, brand = '', category = '', stock = 0) {
  if (stock <= 0) {
    showToast('No hay existencias disponibles para este producto');
    return;
  }

  const existing = CART.find(item => item.sku === sku);
  if (existing) {
    if (existing.quantity >= stock) {
      showToast('Has alcanzado la cantidad máxima disponible');
      return;
    }
    existing.quantity += 1;
  } else {
    CART.push({ sku, name, brand, category, price, quantity: 1, stock });
  }

  updateCartUI();
  showToast('Producto añadido al carrito');
}

function updateQuantity(sku, delta) {
  const item = CART.find(i => i.sku === sku);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    CART = CART.filter(i => i.sku !== sku);
  } else if (item.quantity > item.stock) {
    item.quantity = item.stock;
    showToast('Cantidad limitada al stock disponible');
  }
  updateCartUI();
}

function updateCartUI() {
  const container = document.getElementById('cart-items-container');
  const countNav = document.getElementById('cart-count-nav');
  const countFloat = document.getElementById('cart-count-float');
  const totalLabel = document.getElementById('cart-total');

  saveCart();

  if (!CART.length) {
    container.innerHTML = '<p class="text-xs text-neutral-600 text-center py-20 font-light">El carrito está vacío en este momento.</p>';
    totalLabel.textContent = '$0.00 MXN';
    countNav.textContent = '0';
    countFloat.textContent = '0';
    return;
  }

  const fragment = document.createDocumentFragment();
  let totalItems = 0;
  let totalPrice = 0;

  CART.forEach(item => {
    totalItems += item.quantity;
    totalPrice += item.price * item.quantity;

    const row = document.createElement('div');
    row.className = 'flex flex-col gap-3 border-b border-neutral-900 pb-3';

    const info = document.createElement('div');
    info.className = 'flex items-start justify-between gap-2';

    const details = document.createElement('div');
    details.className = 'flex-1 min-w-0';

    const name = document.createElement('h5');
    name.className = 'text-xs uppercase text-white truncate';
    name.textContent = item.name;

    const meta = document.createElement('p');
    meta.className = 'text-[10px] font-mono text-neutral-500 mt-0.5';
    meta.textContent = `SKU: ${item.sku} | ${item.brand} | ${item.category} | $${item.price.toFixed(2)}`;

    details.appendChild(name);
    details.appendChild(meta);

    const controls = document.createElement('div');
    controls.className = 'flex items-center space-x-2 bg-black border border-neutral-800 p-1';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'text-neutral-400 hover:text-white px-1.5 text-xs';
    minus.textContent = '-';
    minus.addEventListener('click', () => updateQuantity(item.sku, -1));

    const qty = document.createElement('span');
    qty.className = 'text-xs font-mono text-white px-1';
    qty.textContent = item.quantity;

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'text-neutral-400 hover:text-white px-1.5 text-xs';
    plus.textContent = '+';
    plus.addEventListener('click', () => updateQuantity(item.sku, 1));

    controls.appendChild(minus);
    controls.appendChild(qty);
    controls.appendChild(plus);

    info.appendChild(details);
    info.appendChild(controls);
    row.appendChild(info);
    fragment.appendChild(row);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
  totalLabel.textContent = `$${totalPrice.toFixed(2)} MXN`;
  countNav.textContent = String(totalItems);
  countFloat.textContent = String(totalItems);
}

function checkoutWhatsApp() {
  if (!CART.length) {
    showToast('El carrito está vacío');
    return;
  }

  let message = 'Hola Batch Co., me gustaria cotizar la siguiente orden de fragancias:\n\n';
  let total = 0;

  CART.forEach((item, index) => {
    const sub = item.price * item.quantity;
    total += sub;
    const safeName = item.name.replace(/&/g, 'y').replace(/[<>"']/g, '');
    message += `${index + 1}. [${item.quantity} pzs] - ${safeName} (SKU: ${item.sku}) -> Subtotal: $${sub.toFixed(2)} MXN\n`;
  });

  message += `\n*Total estimado neto de la orden: $${total.toFixed(2)} MXN*`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
}

function changePage(delta) {
  const totalPages = Math.max(1, Math.ceil(FILTERED_CACHE.length / getItemsPerPage()));
  currentPage += delta;
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  renderCurrentPage();
  document.getElementById('coleccion').scrollIntoView({ behavior: 'smooth' });
}

function recalcPrices() {
  const marginPercent = Number.parseFloat(DOM.profitMargin.value || 0) / 100;
  if (!ALL_PRODUCTS_CACHE.length) {
    showToast('Carga primero el Excel antes de recalcular');
    return;
  }
  ALL_PRODUCTS_CACHE = ALL_PRODUCTS_CACHE.map(product => ({
    ...product,
    price: Number((product.basePrice * (1 + marginPercent)).toFixed(2))
  }));
  renderCurrentPage();
  showToast('Precios recalculados');
}

function filterByCategory(category) {
  currentCategoryFilter = category;
  currentPage = 1;
  CATEGORY_TABS.forEach(tab => {
    const button = document.getElementById(`tab-${tab}`);
    if (button) button.classList.toggle('tab-active', tab === category);
  });
  executeCombinedFilter();
}

function filterByBrand(brand) {
  currentBrandFilter = brand;
  currentPage = 1;
  document.querySelectorAll('#brands-list button').forEach(button => button.classList.toggle('brand-active', button.id === (brand === BRAND_ALL ? 'brand-TODAS' : `brand-${brand.replace(/\s+/g, '-')}`)));
  executeCombinedFilter();
  document.getElementById('coleccion').scrollIntoView({ behavior: 'smooth' });
}

function toggleCart(show) {
  const drawer = document.getElementById('cart-drawer');
  drawer.classList.toggle('hidden', !show);
}

function clearCart() {
  if (!CART.length) return;
  CART = [];
  updateCartUI();
  showToast('Carrito vaciado');
}

function goToCatalog() {
  switchView('CATALOGO');
}

function goToDirectory() {
  switchView('DIRECTORIO');
}

let sessionPassword = '';

function promptAdminPassword() {
  if (sessionPassword) {
    DOM.adminPanel.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  DOM.adminPasswordModal.classList.remove('hidden');
  DOM.adminPasswordInput.value = '';
  DOM.adminPasswordError.classList.add('hidden');
  DOM.adminPasswordInput.focus();
}

function submitAdminPassword() {
  const pwd = DOM.adminPasswordInput.value.trim();
  if (pwd) {
    sessionPassword = pwd;
    DOM.adminPasswordModal.classList.add('hidden');
    DOM.adminPanel.classList.remove('hidden');
    DOM.adminPanel.scrollIntoView({ behavior: 'smooth' });
    showToast('Acceso concedido');
  } else {
    DOM.adminPasswordError.classList.remove('hidden');
    DOM.adminPasswordInput.value = '';
    DOM.adminPasswordInput.focus();
  }
}

function cancelAdminPassword() {
  DOM.adminPasswordModal.classList.add('hidden');
}

function downloadCatalogData() {
  if (!ALL_PRODUCTS_CACHE.length) {
    showToast('No hay datos para guardar. Sube el Excel primero.');
    return;
  }
  if (!sessionPassword) {
    showToast('Requiere autenticación. Cierra y vuelve a abrir la consola.');
    return;
  }
  showLoading(true);
  fetch('/api/guardar-catalogo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': sessionPassword
    },
    body: JSON.stringify(ALL_PRODUCTS_CACHE)
  })
  .then(async r => {
    const data = await r.json();
    showLoading(false);
    if (r.ok) {
      showToast(`Catálogo guardado: ${data.count} productos`);
    } else {
      showToast(`Error: ${data.error || 'Credenciales rechazadas por el servidor'}`);
    }
  })
  .catch(() => {
    showLoading(false);
    // Fallback GitHub Pages: descargar como archivo
    const json = JSON.stringify(ALL_PRODUCTS_CACHE, null, 2);
    const blob = new Blob([`// Batch Co. - ${ALL_PRODUCTS_CACHE.length} productos\nwindow.__BATCHCO_DATA__ = ${json};\n`], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'datos.js';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Servidor no disponible. Archivo datos.js descargado. Reemplázalo en public/ y haz commit.');
  });
}

function initApp() {
  loadSavedCart();

  // Cargar datos pre-generados si existen (producción)
  if (window.__BATCHCO_DATA__ && Array.isArray(window.__BATCHCO_DATA__) && window.__BATCHCO_DATA__.length) {
    ALL_PRODUCTS_CACHE = window.__BATCHCO_DATA__;
    buildBrandList();
    currentPage = 1;
    DOM.searchContainer.classList.remove('hidden');
    DOM.macroTabs.classList.remove('hidden');
    DOM.sidebarContainer.classList.remove('hidden');
    DOM.paginationControls.classList.remove('hidden');
    renderBrandsSidebar();
    renderBrandsDirectory();
    executeCombinedFilter();
  }

  if (DOM.excelInput) DOM.excelInput.addEventListener('change', onExcelUpload);
  DOM.searchInput.addEventListener('input', debounce(() => { currentPage = 1; executeCombinedFilter(); }, 180));
  DOM.searchInput.addEventListener('input', debounce(showBrandSuggestions, 100));
  DOM.searchInput.addEventListener('keydown', handleSuggestionsKeyboard);
  document.addEventListener('click', (e) => {
    if (DOM.brandSuggestions && !DOM.searchInput.contains(e.target) && !DOM.brandSuggestions.contains(e.target)) {
      DOM.brandSuggestions.classList.add('hidden');
    }
  });
  if (DOM.priceMinInput) DOM.priceMinInput.addEventListener('input', debounce(() => { currentPage = 1; executeCombinedFilter(); }, 300));
  if (DOM.priceMaxInput) DOM.priceMaxInput.addEventListener('input', debounce(() => { currentPage = 1; executeCombinedFilter(); }, 300));
  DOM.recalcPricesBtn.addEventListener('click', recalcPrices);
  if (DOM.applyMappingBtn) DOM.applyMappingBtn.addEventListener('click', applyColumnMapping);
  DOM.clearFiltersBtn.addEventListener('click', resetFilters);
  if (DOM.logoLink) DOM.logoLink.addEventListener('click', (event) => { event.preventDefault(); goToCatalog(); });
  if (DOM.heroActionBtn) DOM.heroActionBtn.addEventListener('click', (event) => { event.preventDefault(); goToCatalog(); });
  if (DOM.navColeccionBtn) DOM.navColeccionBtn.addEventListener('click', (event) => { event.preventDefault(); goToCatalog(); });
  if (DOM.navDirectorioBtn) DOM.navDirectorioBtn.addEventListener('click', (event) => { event.preventDefault(); goToDirectory(); });
  if (DOM.applyDirectoryFilterBtn) DOM.applyDirectoryFilterBtn.addEventListener('click', applyDirectoryFilter);
  if (DOM.noProductsClearBtn) DOM.noProductsClearBtn.addEventListener('click', resetFilters);
  if (DOM.adminPasswordSubmit) DOM.adminPasswordSubmit.addEventListener('click', submitAdminPassword);
  if (DOM.adminPasswordCancel) DOM.adminPasswordCancel.addEventListener('click', cancelAdminPassword);
  if (DOM.adminPasswordInput) DOM.adminPasswordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAdminPassword(); });
  if (DOM.downloadDataBtn) DOM.downloadDataBtn.addEventListener('click', downloadCatalogData);
  if (DOM.cartClearBtn) DOM.cartClearBtn.addEventListener('click', clearCart);
  window.addEventListener('resize', debounce(renderCurrentPage, 200));

  window.filterByCategory = filterByCategory;
  window.changePage = changePage;
  window.addToCart = addToCart;
  window.updateQuantity = updateQuantity;
  window.checkoutWhatsApp = checkoutWhatsApp;
  window.selectBrandFromDirectory = selectBrandFromDirectory;
  window.goToCatalog = goToCatalog;
  window.applyDirectoryFilter = applyDirectoryFilter;
  window.toggleDirectoryBrand = toggleDirectoryBrand;
  window.goToDirectory = goToDirectory;
  window.toggleCart = toggleCart;
  window.filterByBrand = filterByBrand;
  window.promptAdminPassword = promptAdminPassword;

  renderBrandsDirectory();
  updateCartUI();
  if (!ALL_PRODUCTS_CACHE.length) {
    DOM.macroTabs.classList.add('hidden');
    DOM.searchContainer.classList.add('hidden');
    DOM.columnMappingPanel?.classList.add('hidden');
    DOM.paginationControls.classList.add('hidden');
  }

  window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global error:', message, source, lineno, colno, error);
    showToast('Ocurrió un error inesperado. Revisa la consola.');
    return false;
  };
}

initApp();
