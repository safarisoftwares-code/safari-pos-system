let products = [];
let categories = [];
let cart = [];
let discount = 0;
let businessSettings = null;

function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(viewName).style.display = 'block';
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('sidebar').classList.remove('active');
    
    if (viewName === 'products') loadProducts();
    if (viewName === 'categories') loadCategories();
    if (viewName === 'users') loadUsers();
    if (viewName === 'reports') { loadAllSales(); loadLowStock(); }
    if (viewName === 'pos') loadProductsForPOS();
    if (viewName === 'backup') loadBackups();
    if (viewName === 'settings') loadSettings();
    if (viewName === 'dashboard') loadDashboard();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function openProductModal() { loadCategoriesForSelect(); openModal('productModal'); }
function openCategoryModal() { openModal('categoryModal'); }
function openUserModal() { openModal('userModal'); }

async function apiCall(url, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: authManager.getAuthHeaders()
    };
    if (data) options.body = JSON.stringify(data);
    
    const response = await fetch(API_BASE_URL + url, options);
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Request failed');
    }
    
    return response.json();
}

// ============ CATEGORIES ============
async function loadCategories() {
    try {
        categories = await apiCall('/products/categories');
        const tbody = document.getElementById('categoriesTableBody');
        if (tbody) {
            tbody.innerHTML = categories.map(c => 
                '<tr><td>' + c.id + '</td><td>' + c.name + '</td><td>' + (c.description || '-') + '</td></tr>'
            ).join('') || '<tr><td colspan="3" style="text-align:center;">No categories yet</td></tr>';
        }
    } catch (e) { console.error(e); }
}

async function loadCategoriesForSelect() {
    try {
        categories = await apiCall('/products/categories');
        const select = document.getElementById('productCategory');
        if (select) {
            select.innerHTML = '<option value="">Select Category</option>' + 
                categories.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');
        }
        const posFilter = document.getElementById('posCategoryFilter');
        if (posFilter) {
            posFilter.innerHTML = '<option value="all">All Categories</option>' + 
                categories.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');
        }
    } catch (e) { console.error(e); }
}

document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await apiCall('/products/categories', 'POST', {
            name: document.getElementById('categoryName').value,
            description: document.getElementById('categoryDescription').value || null
        });
        closeModal('categoryModal');
        e.target.reset();
        alert('Category added!');
        loadCategories();
    } catch (e) { alert(e.message); }
});

// ============ PRODUCTS ============
async function loadProducts() {
    try {
        products = await apiCall('/products');
        const tbody = document.getElementById('productsTableBody');
        if (tbody) {
            tbody.innerHTML = products.map(p => {
                const cat = categories.find(c => c.id === p.category_id);
                return '<tr><td>' + p.id + '</td><td>' + p.name + '</td><td>' + (p.unit || '-') + '</td><td>' + (cat ? cat.name : '-') + '</td><td>KSh ' + p.price + '</td><td>' + (p.tax_rate || 16) + '%</td><td>' + p.stock + '</td><td><button class="btn btn-danger" onclick="deleteProduct(' + p.id + ')" style="padding: 5px 10px; font-size: 12px;">Delete</button></td></tr>';
            }).join('') || '<tr><td colspan="8" style="text-align:center;">No products yet</td></tr>';
        }
    } catch (e) { alert(e.message); }
}

async function loadProductsForPOS() {
    await loadCategoriesForSelect();
    try {
        products = await apiCall('/products');
        renderPOSProducts(products);
    } catch (e) { alert(e.message); }
}

function renderPOSProducts(list) {
    const grid = document.getElementById('productGrid');
    if (grid) {
        grid.innerHTML = list.map(p => 
            '<div class="product-card" onclick="addToCart(' + p.id + ')">' +
            '<div class="product-name">' + p.name + '</div>' +
            (p.unit ? '<div style="font-size: 12px; color: #666;">' + p.unit + '</div>' : '') +
            '<div class="product-price">KSh ' + p.price + '</div>' +
            '<div style="font-size: 11px; color: #d2691e;">Tax: ' + (p.tax_rate || 16) + '%</div>' +
            '<div class="product-stock">Stock: ' + p.stock + '</div>' +
            '</div>'
        ).join('');
    }
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await apiCall('/products', 'POST', {
            name: document.getElementById('productName').value,
            unit: document.getElementById('productUnit').value || null,
            category_id: document.getElementById('productCategory').value ? parseInt(document.getElementById('productCategory').value) : null,
            price: parseFloat(document.getElementById('productPrice').value),
            tax_rate: parseFloat(document.getElementById('productTaxRate').value) || 0,
            stock: parseInt(document.getElementById('productStock').value)
        });
        closeModal('productModal');
        e.target.reset();
        alert('Product added!');
        loadProducts();
    } catch (e) { alert(e.message); }
});

async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
        await apiCall('/products/' + id, 'DELETE');
        loadProducts();
    } catch (e) { alert(e.message); }
}

// ============ USERS ============
async function loadUsers() {
    try {
        const users = await apiCall('/users');
        document.getElementById('usersTableBody').innerHTML = users.map(u => 
            '<tr><td>' + u.id + '</td><td>' + u.name + '</td><td>' + u.email + '</td><td>' + u.role.toUpperCase() + '</td>' +
            '<td><button class="btn btn-danger" onclick="deleteUser(' + u.id + ')" style="padding: 5px 10px; font-size: 12px;">Remove</button></td></tr>'
        ).join('');
    } catch (e) { alert(e.message); }
}

async function deleteUser(id) {
    if (!confirm('Deactivate this user?')) return;
    try {
        await apiCall('/users/' + id, 'DELETE');
        alert('User deactivated!');
        loadUsers();
    } catch (e) { alert(e.message); }
}

document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await apiCall('/users', 'POST', {
            name: document.getElementById('userNameInput').value,
            email: document.getElementById('userEmail').value,
            password: document.getElementById('userPassword').value,
            role: document.getElementById('userRoleSelect').value
        });
        closeModal('userModal');
        e.target.reset();
        alert('User added!');
        loadUsers();
    } catch (e) { alert(e.message); }
});

// ============ POS / CART ============
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) { alert('Out of stock!'); return; }
    
    const existing = cart.find(i => i.product_id === productId);
    if (existing) {
        if (existing.quantity >= product.stock) { alert('Not enough stock!'); return; }
        existing.quantity++;
    } else {
        cart.push({ 
            product_id: product.id, 
            name: product.name, 
            unit: product.unit, 
            quantity: 1, 
            unit_price: product.price, 
            tax_rate: product.tax_rate || 16,
            stock: product.stock 
        });
    }
    updateCart();
}

function removeFromCart(productId) {
    cart = cart.filter(i => i.product_id !== productId);
    updateCart();
}

function updateQuantity(productId, change) {
    const item = cart.find(i => i.product_id === productId);
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) { removeFromCart(productId); return; }
    if (item.quantity > item.stock) { alert('Not enough stock!'); item.quantity -= change; return; }
    updateCart();
}

function updateCart() {
    const cartDiv = document.getElementById('cartItems');
    
    let subtotal = 0;
    let taxAmount = 0;
    
    cart.forEach(item => {
        const lineTotal = item.quantity * item.unit_price;
        const itemTaxRate = item.tax_rate || 16;
        const lineTax = lineTotal * (itemTaxRate / 100);
        subtotal += lineTotal;
        taxAmount += lineTax;
    });
    
    const discountAmount = subtotal * (discount / 100);
    const total = subtotal + taxAmount - discountAmount;
    
    if (cartDiv) {
        if (cart.length === 0) {
            cartDiv.innerHTML = '<p style="color: #95a5a6; text-align: center; margin-top: 50px;">Cart is empty</p>';
        } else {
            cartDiv.innerHTML = cart.map(i => {
                const lineTotal = i.quantity * i.unit_price;
                const itemTaxRate = i.tax_rate || 16;
                const lineTax = lineTotal * (itemTaxRate / 100);
                
                return '<div class="cart-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #ecf0f1;">' +
                    '<div style="flex: 2;">' +
                        '<strong>' + i.name + '</strong>' +
                        (i.unit ? ' <small>(' + i.unit + ')</small>' : '') +
                        '<br><small>KSh ' + i.unit_price + ' each</small>' +
                    '</div>' +
                    '<div style="flex: 1; display: flex; gap: 5px; align-items: center;">' +
                        '<button onclick="updateQuantity(' + i.product_id + ', -1)" style="width: 25px; height: 25px; cursor: pointer;">-</button>' +
                        '<span>' + i.quantity + '</span>' +
                        '<button onclick="updateQuantity(' + i.product_id + ', 1)" style="width: 25px; height: 25px; cursor: pointer;">+</button>' +
                    '</div>' +
                    '<div style="flex: 2; text-align: right;">' +
                        '<strong>KSh ' + lineTotal.toFixed(2) + '</strong>' +
                        '<br><small style="color: #d2691e;">Tax: KSh ' + lineTax.toFixed(2) + '</small>' +
                    '</div>' +
                    '<button onclick="removeFromCart(' + i.product_id + ')" style="color: red; background: none; border: none; cursor: pointer; font-size: 18px;">X</button>' +
                '</div>';
            }).join('');
        }
    }
    
    document.getElementById('subtotal').textContent = 'KSh ' + subtotal.toFixed(2);
    document.getElementById('tax').textContent = 'KSh ' + taxAmount.toFixed(2);
    document.getElementById('discount').textContent = '-KSh ' + discountAmount.toFixed(2);
    document.getElementById('total').textContent = 'KSh ' + total.toFixed(2);
}

async function checkout() {
    if (cart.length === 0) { alert('Cart is empty!'); return; }
    
    // Payment method selection modal
    const method = prompt('Payment method (cash/mpesa/card):', 'cash');
    if (!method) return;
    
    try {
        const sale = await apiCall('/sales', 'POST', {
            items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
            payment_method: method,
            discount: discount
        });
        
        // Reload fresh business settings before printing
        await loadBusinessSettings();
        
        // Print receipt
        printReceipt(sale);
        
        cart = [];
        discount = 0;
        document.getElementById('discountInput').value = 0;
        updateCart();
        loadProductsForPOS();
        loadDashboard();
    } catch (e) { alert(e.message); }
}

function printReceipt(sale) {
    // Build receipt HTML using ONLY businessSettings (no hardcoded fallbacks)
    let itemsHtml = '';
    sale.items.forEach(item => {
        const lineTotal = item.quantity * item.unit_price;
        const lineTax = lineTotal * (item.tax_rate || 16) / 100;
        itemsHtml += '<tr>' +
            '<td>' + item.name + (item.unit ? ' (' + item.unit + ')' : '') + '</td>' +
            '<td style="text-align:center;">' + item.quantity + '</td>' +
            '<td style="text-align:right;">' + lineTotal.toFixed(2) + '</td>' +
            '</tr>';
    });
    
    // Build header from businessSettings ONLY
    let headerHtml = '';
    if (businessSettings) {
        headerHtml += '<h2>' + (businessSettings.business_name || '') + '</h2>';
        if (businessSettings.business_po_box) {
            headerHtml += '<p>' + businessSettings.business_po_box + '</p>';
        }
        if (businessSettings.business_location) {
            headerHtml += '<p>' + businessSettings.business_location + '</p>';
        }
        if (businessSettings.business_phone) {
            headerHtml += '<p>Tel: ' + businessSettings.business_phone + '</p>';
        }
    }
    
    // Build tax PIN line
    let taxPinHtml = '';
    if (businessSettings && businessSettings.business_tax_pin) {
        taxPinHtml = '<p style="font-size:11px;">Tax PIN: ' + businessSettings.business_tax_pin + '</p><hr>';
    }
    
    // Build footer
    let footerHtml = '';
    if (businessSettings && businessSettings.receipt_footer) {
        footerHtml += '<p>' + businessSettings.receipt_footer + '</p>';
    }
    footerHtml += '<hr><p style="font-size:10px; color:#666;">Safari POS - (c) Safari Softwares</p>';
    
    const receiptHtml = '<!DOCTYPE html><html><head><title>Receipt ' + sale.receipt_no + '</title>' +
        '<style>' +
        'body { font-family: "Courier New", monospace; padding: 20px; max-width: 300px; margin: auto; }' +
        '.header { text-align: center; margin-bottom: 15px; }' +
        '.header h2 { margin: 0; font-size: 18px; }' +
        '.header p { margin: 2px 0; font-size: 12px; }' +
        'hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }' +
        'table { width: 100%; font-size: 12px; border-collapse: collapse; }' +
        'th { text-align: left; padding: 3px 0; }' +
        'td { padding: 3px 0; }' +
        '.total-row { font-weight: bold; font-size: 14px; }' +
        '.footer { text-align: center; margin-top: 15px; font-size: 11px; }' +
        '@media print { body { margin: 0; } }' +
        '</style></head><body>' +
        '<div class="header">' + headerHtml + '</div>' +
        '<hr>' +
        '<p style="font-size:12px;">Receipt: ' + sale.receipt_no + '</p>' +
        '<p style="font-size:12px;">Date: ' + new Date(sale.created_at).toLocaleString() + '</p>' +
        '<hr>' +
        taxPinHtml +
        '<table>' +
        '<thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Amount</th></tr></thead>' +
        '<tbody>' + itemsHtml + '</tbody>' +
        '</table>' +
        '<hr>' +
        '<table>' +
        '<tr><td>Subtotal:</td><td style="text-align:right;">' + sale.subtotal.toFixed(2) + '</td></tr>' +
        '<tr><td>Tax:</td><td style="text-align:right;">' + sale.tax_amount.toFixed(2) + '</td></tr>' +
        '<tr><td>Discount:</td><td style="text-align:right;">-' + sale.discount.toFixed(2) + '</td></tr>' +
        '<tr class="total-row"><td>TOTAL:</td><td style="text-align:right;">KSh ' + sale.total_amount.toFixed(2) + '</td></tr>' +
        '</table>' +
        '<hr>' +
        '<p style="font-size:12px;">Payment: ' + sale.payment_method.toUpperCase() + '</p>' +
        '<div class="footer">' + footerHtml + '</div>' +
        '</body></html>';
    
    // Open print window
    const printWindow = window.open('', 'Receipt', 'width=400,height=600');
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    
    // Wait for content to load then print
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

// ============ DASHBOARD ============
async function loadDashboard() {
    try {
        const data = await apiCall('/sales/today');
        document.getElementById('todaySales').textContent = data.count;
        document.getElementById('todayRevenue').textContent = 'KSh ' + data.total_amount.toFixed(2);
        
        const tbody = document.getElementById('todaySalesTableBody');
        if (tbody && data.sales) {
            tbody.innerHTML = data.sales.map(s => 
                '<tr><td>' + s.receipt_no + '</td><td>' + s.created_at + '</td><td>' + s.cashier + '</td><td>' + s.payment_method.toUpperCase() + '</td><td>KSh ' + s.total_amount.toFixed(2) + '</td></tr>'
            ).join('') || '<tr><td colspan="5" style="text-align:center;">No sales yet today</td></tr>';
        }
    } catch (e) { console.error(e); }
}

// ============ REPORTS ============
async function loadAllSales() {
    try {
        const sales = await apiCall('/sales/all');
        const tbody = document.getElementById('allSalesTableBody');
        if (tbody) {
            tbody.innerHTML = sales.map(s => 
                '<tr><td>' + s.receipt_no + '</td><td>' + s.created_at + '</td><td>' + s.cashier + '</td><td>KSh ' + s.subtotal.toFixed(2) + '</td><td>KSh ' + s.tax_amount.toFixed(2) + '</td><td>KSh ' + s.total_amount.toFixed(2) + '</td></tr>'
            ).join('') || '<tr><td colspan="6" style="text-align:center;">No sales yet</td></tr>';
        }
    } catch (e) { alert(e.message); }
}

async function loadLowStock() {
    try {
        const products = await apiCall('/reports/low-stock');
        document.getElementById('lowStockList').innerHTML = products.map(p => 
            '<div style="padding: 10px; background: #fff3cd; margin-bottom: 5px; border-radius: 5px;"><strong>' + p.name + '</strong> - Stock: ' + p.stock + '</div>'
        ).join('') || '<p>No low stock items</p>';
    } catch (e) { console.error(e); }
}

// ============ SETTINGS ============
async function loadSettings() {
    try {
        const settings = await apiCall('/settings');
        document.getElementById('defaultTaxRate').value = settings.default_tax_rate;
        document.getElementById('businessName').value = settings.business_name || '';
        document.getElementById('businessPoBox').value = settings.business_po_box || '';
        document.getElementById('businessLocation').value = settings.business_location || '';
        document.getElementById('businessPhone').value = settings.business_phone || '';
        document.getElementById('businessTaxPin').value = settings.business_tax_pin || '';
        document.getElementById('receiptFooter').value = settings.receipt_footer || '';
    } catch (e) { console.error(e); }
}

async function updateBusinessInfo() {
    try {
        await apiCall('/settings/business', 'PUT', {
            business_name: document.getElementById('businessName').value,
            business_po_box: document.getElementById('businessPoBox').value,
            business_location: document.getElementById('businessLocation').value,
            business_phone: document.getElementById('businessPhone').value,
            business_tax_pin: document.getElementById('businessTaxPin').value,
            receipt_footer: document.getElementById('receiptFooter').value
        });
        alert('Business info saved!');
    } catch (e) { alert(e.message); }
}

async function updateTaxRate() {
    const rate = parseFloat(document.getElementById('defaultTaxRate').value);
    try {
        await apiCall('/settings/tax-rate?rate=' + rate, 'PUT');
        alert('Tax rate updated to ' + rate + '%');
    } catch (e) { alert(e.message); }
}

// ============ BACKUP ============
async function createBackup() {
    try {
        await apiCall('/backup/create', 'POST');
        alert('Backup created!');
        loadBackups();
    } catch (e) { alert(e.message); }
}

async function loadBackups() {
    try {
        const backups = await apiCall('/backup/list');
        document.getElementById('backupsTableBody').innerHTML = backups.map(b => 
            '<tr><td>' + b.filename + '</td><td>' + (b.size / 1024).toFixed(2) + ' KB</td><td>' + b.created + '</td><td><button onclick="deleteBackup(\'' + b.filename + '\')" style="color: red;">Delete</button></td></tr>'
        ).join('') || '<tr><td colspan="4" style="text-align:center;">No backups</td></tr>';
    } catch (e) { console.error(e); }
}

async function deleteBackup(filename) {
    if (!confirm('Delete this backup?')) return;
    try {
        await apiCall('/backup/' + filename, 'DELETE');
        loadBackups();
    } catch (e) { alert(e.message); }
}

// ============ EVENT LISTENERS ============
document.getElementById('discountInput').addEventListener('input', (e) => {
    discount = parseFloat(e.target.value) || 0;
    updateCart();
});

document.getElementById('searchProduct').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    renderPOSProducts(products.filter(p => p.name.toLowerCase().includes(term)));
});

document.getElementById('posCategoryFilter').addEventListener('change', (e) => {
    const catId = e.target.value;
    if (catId === 'all') renderPOSProducts(products);
    else renderPOSProducts(products.filter(p => p.category_id == catId));
});

// ============ INIT ============
async function loadBusinessSettings() {
    try {
        businessSettings = await apiCall('/settings');
        console.log('Business settings loaded:', businessSettings);
    } catch (e) { 
        console.error('Error loading settings:', e);
        businessSettings = {
            business_name: 'SAFARI POS',
            business_po_box: '',
            business_location: '',
            business_phone: '',
            business_tax_pin: '',
            receipt_footer: 'Thank you! Karibu Tena!'
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadCategoriesForSelect();
});

// ============ TOGGLE SECTIONS ============
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const icon = document.getElementById(sectionId + 'Icon');
    
    if (section.style.display === 'none' || section.style.display === '') {
        section.style.display = 'block';
        if (icon) icon.textContent = '-';
    } else {
        section.style.display = 'none';
        if (icon) icon.textContent = '+';
    }
}
