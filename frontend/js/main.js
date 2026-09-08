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
    if (viewName === 'reports') { loadAllSales(); loadLowStock(); loadDailyClose(); loadProfitReport(); }
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
                return '<tr><td>' + p.id + '</td><td>' + p.name + '</td><td>' + (p.unit || '-') + '</td><td>' + (cat ? cat.name : '-') + '</td><td>KSh ' + p.price + '</td><td>' + (p.tax_rate || 16) + '%</td><td>' + p.stock + '</td><td><button class="btn btn-secondary" onclick="openStockModal(' + p.id + ')" style="padding: 5px 10px; font-size: 12px; margin-right: 5px; background: #d2691e; color: white; border: none; border-radius: 5px; cursor: pointer;">Stock</button> <button class="btn btn-danger" onclick="deleteProduct(' + p.id + ')" style="padding: 5px 10px; font-size: 12px;">Delete</button></td></tr>';
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
            (p.stock <= 0 
                ? '<div style="background: #d32f2f; color: white; padding: 2px 5px; border-radius: 3px; font-size: 11px;">OUT OF STOCK</div>'
                : '<div class="product-stock">Stock: ' + p.stock + '</div>') +
            '</div>'
        ).join('');
    }
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await apiCall('/products', 'POST', {
            name: document.getElementById('productName').value,
            barcode: document.getElementById('productBarcode').value || null,
            unit: document.getElementById('productUnit').value || null,
            category_id: document.getElementById('productCategory').value ? parseInt(document.getElementById('productCategory').value) : null,
            price: parseFloat(document.getElementById('productPrice').value),
            cost: parseFloat(document.getElementById('productCost').value) || null,
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
    const product = products.find(p => p.id === id);
    const firstName = prompt('Type DELETE to confirm deletion of: ' + (product ? product.name : 'this product') + '\n\nThis cannot be undone!');
    if (firstName !== 'DELETE') {
        alert('Deletion cancelled. You must type DELETE exactly.');
        return;
    }
    const secondConfirm = confirm('Are you ABSOLUTELY sure?\n\nProduct: ' + (product ? product.name : 'Unknown') + '\n\nThis will permanently remove the product from active list.');
    if (!secondConfirm) return;
    
    try {
        await apiCall('/products/' + id, 'DELETE');
        alert('Product deleted successfully.');
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
    const firstName = prompt('Type DELETE to confirm deactivation of this user.\n\nSales records will be preserved.');
    if (firstName !== 'DELETE') {
        alert('Deactivation cancelled.');
        return;
    }
    const secondConfirm = confirm('Final confirmation: Deactivate this user?\n\nThey will no longer be able to login.');
    if (!secondConfirm) return;
    
    try {
        await apiCall('/users/' + id, 'DELETE');
        alert('User deactivated successfully.');
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
    if (!product) { alert('Product not found!'); return; }
    if (product.stock <= 0) { 
        alert('❌ OUT OF STOCK!\n\n' + product.name + '\n\nStock Remaining: 0 units\n\nYou cannot sell what you do not have.\n\nPlease restock this item.');
        return; 
    }
    
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
    if (item.quantity > item.stock) { 
        alert('⚠️ NOT ENOUGH STOCK!\n\n' + item.name + '\n\nAvailable: ' + item.stock + ' units\nRequested: ' + item.quantity + ' units\n\nReduce quantity or restock.');
        item.quantity -= change; 
        return; 
    }
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
    
    // Verify stock before checkout
    for (const item of cart) {
        const product = products.find(p => p.id === item.product_id);
        if (product && product.stock <= 0) {
            alert('❌ OUT OF STOCK!\n\n' + item.name + '\n\nStock Remaining: 0 units\n\nRemove from cart to continue.');
            return;
        }
        if (product && item.quantity > product.stock) {
            alert('⚠️ INSUFFICIENT STOCK!\n\n' + item.name + '\n\nAvailable: ' + product.stock + ' units\nIn Cart: ' + item.quantity + ' units\n\nReduce quantity or remove item.');
            return;
        }
    }
    
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
    const firstName = prompt('Type DELETE to permanently remove backup: ' + filename);
    if (firstName !== 'DELETE') {
        alert('Backup deletion cancelled.');
        return;
    }
    const secondConfirm = confirm('This backup will be permanently deleted. Continue?');
    if (!secondConfirm) return;
    
    try {
        await apiCall('/backup/' + filename, 'DELETE');
        alert('Backup deleted.');
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



// ============ BARCODE SCANNER ============
document.getElementById('barcodeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const barcode = e.target.value.trim();
        
        if (barcode) {
            // Find product by barcode
            const product = products.find(p => p.barcode === barcode);
            
            if (product) {
                addToCart(product.id);
                e.target.value = ''; // Clear for next scan
            } else {
                // Try to find by ID if no barcode match
                const productById = products.find(p => p.id == barcode);
                if (productById) {
                    addToCart(productById.id);
                    e.target.value = '';
                } else {
                    alert('Product not found for barcode: ' + barcode);
                    e.target.value = '';
                }
            }
        }
    }
});

// Keep focus on barcode input
document.addEventListener('click', () => {
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput && document.getElementById('pos').style.display !== 'none') {
        barcodeInput.focus();
    }
});



// ============ SCANNER TEST ============
document.getElementById('scannerTest').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const barcode = e.target.value.trim();
        if (barcode) {
            const product = products.find(p => p.barcode === barcode);
            const resultDiv = document.getElementById('scannerResult');
            
            if (product) {
                resultDiv.innerHTML = '<div style="background: #d4edda; padding: 10px; border-radius: 5px; color: #2e7d32;"><strong>SCANNER WORKING!</strong><br>Product found: ' + product.name + '<br>Price: KSh ' + product.price + '</div>';
            } else {
                resultDiv.innerHTML = '<div style="background: #fff3cd; padding: 10px; border-radius: 5px; color: #856404;"><strong>Scanner detected input:</strong> ' + barcode + '<br>No product found with this barcode yet. Add it in Products tab.</div>';
            }
            e.target.value = '';
        }
    }
});

// Also test scanner on login page (any input field)
document.addEventListener('keydown', (e) => {
    // If scanner types quickly (less than 50ms between characters), it's a scanner
    if (e.target && e.target.tagName === 'INPUT' && e.target.id !== 'scannerTest') {
        const now = Date.now();
        if (!window.lastKeyTime) window.lastKeyTime = now;
        const timeDiff = now - window.lastKeyTime;
        window.lastKeyTime = now;
        
        if (timeDiff < 50 && e.key !== 'Enter' && e.key.length === 1) {
            // This is likely a scanner (fast input)
            console.log('Scanner detected on field:', e.target.id);
        }
    }
});



// ============ EXPORT TO CSV ============
async function exportSalesCSV() {
    try {
        const sales = await apiCall('/sales/all');
        
        if (sales.length === 0) {
            alert('No sales data to export.');
            return;
        }
        
        // CSV header
        let csv = 'Receipt No,Date/Time,Cashier,Subtotal,Tax,Discount,Total,Payment Method\n';
        
        // Add rows
        sales.forEach(s => {
            csv += s.receipt_no + ',' + s.created_at + ',' + s.cashier + ',' + 
                   s.subtotal + ',' + s.tax_amount + ',' + s.discount + ',' + 
                   s.total_amount + ',' + s.payment_method + '\n';
        });
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sales_report_' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        
    } catch (e) { alert(e.message); }
}

async function exportProductsCSV() {
    try {
        const products = await apiCall('/products');
        
        if (products.length === 0) {
            alert('No products to export.');
            return;
        }
        
        let csv = 'ID,Name,Unit,Price,Stock,Tax Rate\n';
        products.forEach(p => {
            csv += p.id + ',' + p.name + ',' + (p.unit || '') + ',' + p.price + ',' + p.stock + ',' + (p.tax_rate || 16) + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products_report_' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        
    } catch (e) { alert(e.message); }
}



// ============ DAILY CLOSE REPORT ============
async function loadDailyClose() {
    try {
        const data = await apiCall('/sales/daily-close');
        const tbody = document.getElementById('dailyCloseTableBody');
        if (tbody) {
            tbody.innerHTML = 
                '<tr><td>Cash</td><td style="text-align:right;">KSh ' + data.cash_total.toFixed(2) + '</td></tr>' +
                '<tr><td>M-Pesa</td><td style="text-align:right;">KSh ' + data.mpesa_total.toFixed(2) + '</td></tr>' +
                '<tr><td>Card</td><td style="text-align:right;">KSh ' + data.card_total.toFixed(2) + '</td></tr>' +
                '<tr><td>Credit</td><td style="text-align:right;">KSh ' + data.credit_total.toFixed(2) + '</td></tr>' +
                '<tr style="font-weight: bold; border-top: 2px solid #8b4513;"><td>TOTAL</td><td style="text-align:right;">KSh ' + data.grand_total.toFixed(2) + '</td></tr>';
        }
        document.getElementById('dailyCloseDate').textContent = data.date;
        document.getElementById('dailyCloseTransactions').textContent = data.total_transactions;
    } catch (e) { console.error(e); }
}

// ============ STOCK ADJUSTMENT ============
function openStockModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    document.getElementById('stockProductId').value = product.id;
    document.getElementById('stockProductName').textContent = product.name;
    document.getElementById('stockCurrent').textContent = product.stock;
    document.getElementById('stockAdjustment').value = '';
    document.getElementById('stockReason').value = '';
    document.getElementById('stockModal').classList.add('active');
}

document.getElementById('stockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('stockProductId').value;
    const adjustment = parseInt(document.getElementById('stockAdjustment').value);
    const reason = document.getElementById('stockReason').value || 'manual';
    
    try {
        await apiCall('/products/' + productId + '/stock?adjustment=' + adjustment + '&reason=' + reason, 'PUT');
        closeModal('stockModal');
        alert('Stock adjusted successfully!');
        loadProducts();
    } catch (e) { alert(e.message); }
});

// ============ RECEIPT REPRINT ============
async function reprintLastReceipt() {
    try {
        const sales = await apiCall('/sales/all');
        if (sales.length === 0) {
            alert('No sales found to reprint.');
            return;
        }
        const lastSale = sales[0];
        
        // Build simple receipt for reprint
        const receiptHtml = '<!DOCTYPE html><html><head><title>Reprint ' + lastSale.receipt_no + '</title>' +
            '<style>body{font-family:"Courier New",monospace;padding:20px;max-width:300px;margin:auto}' +
            '.header{text-align:center;margin-bottom:15px}hr{border:none;border-top:1px dashed #000;margin:10px 0}' +
            'table{width:100%;font-size:12px;border-collapse:collapse}td{padding:3px 0}' +
            '.total-row{font-weight:bold;font-size:14px}</style></head><body>' +
            '<div class="header"><h2>REPRINT</h2><p>' + (businessSettings ? businessSettings.business_name : '') + '</p></div>' +
            '<hr><p>Receipt: ' + lastSale.receipt_no + '</p>' +
            '<p>Date: ' + lastSale.created_at + '</p><hr>' +
            '<table>' +
            '<tr><td>Subtotal:</td><td style="text-align:right;">' + lastSale.subtotal.toFixed(2) + '</td></tr>' +
            '<tr><td>Tax:</td><td style="text-align:right;">' + lastSale.tax_amount.toFixed(2) + '</td></tr>' +
            '<tr class="total-row"><td>TOTAL:</td><td style="text-align:right;">KSh ' + lastSale.total_amount.toFixed(2) + '</td></tr>' +
            '</table><hr>' +
            '<p>Payment: ' + lastSale.payment_method.toUpperCase() + '</p>' +
            '<p style="text-align:center;margin-top:20px;font-size:10px;color:#666;">Safari POS - (c) Safari Softwares</p>' +
            '</body></html>';
        
        const printWindow = window.open('', 'Reprint', 'width=400,height=600');
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
        
    } catch (e) { alert(e.message); }
}

// ============ PROFIT REPORT ============
async function loadProfitReport() {
    try {
        const profitData = await apiCall('/reports/profit');
        const tbody = document.getElementById('profitTableBody');
        if (tbody) {
            tbody.innerHTML = profitData.map(p => 
                '<tr><td>' + p.product + '</td>' +
                '<td>KSh ' + p.selling_price + '</td>' +
                '<td>' + p.tax_rate + '%</td>' +
                '<td>KSh ' + p.net_selling + '</td>' +
                '<td>KSh ' + p.cost + '</td>' +
                '<td style="color: ' + (p.gross_profit >= 0 ? '#2e7d32' : '#d32f2f') + ';">KSh ' + p.gross_profit + '</td>' +
                '<td>' + p.profit_margin + '%</td></tr>'
            ).join('') || '<tr><td colspan="7" style="text-align:center;">No products with cost price set</td></tr>';
        }
    } catch (e) { alert(e.message); }
}

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
