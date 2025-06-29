// Importa as funções necessárias do Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, writeBatch } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Variáveis globais para Firebase e Firestore
let db;
let auth;
let userId; // Manter userId, mesmo que não seja usado para dados públicos, pode ser útil para outras operações
let isAuthReady = false; // Flag para indicar se a autenticação está pronta
let suppliers = {}; // Objeto global para armazenar os dados dos prestadores

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBnlo7m5p3VuXnjRas1KUphkNbT-1hSYSk",
    authDomain: "controle-faturas-874bf.firebaseapp.com",
    projectId: "controle-faturas-874bf",
    storageBucket: "controle-faturas-874bf.firebasestorage.app",
    messagingSenderId: "497052992643",
    appId: "1:497052992643:web:04db16f7886b212b6b87b6"
};

// Inicializa o Firebase e o Firestore quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', async function () {
    // Inicializa o aplicativo Firebase
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Variável do ID do aplicativo fornecida pelo ambiente Canvas
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Observa as mudanças no estado de autenticação
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
        } else {
            try {
                // Preferir __initial_auth_token se disponível e válido
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token !== null) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                    userId = auth.currentUser.uid;
                    console.log("Autenticado com token personalizado.");
                } else {
                    // Caso contrário, autenticar anonimamente
                    await signInAnonymously(auth);
                    userId = auth.currentUser.uid;
                    console.log("Autenticado anonimamente.");
                }
            } catch (error) {
                console.error("Erro na autenticação:", error);
                // Se a autenticação falhar, usamos um ID temporário
                userId = crypto.randomUUID();
                console.warn("Falha na autenticação Firebase, usando ID de usuário temporário. Dados públicos continuarão a funcionar.");
            }
        }
        isAuthReady = true;
        console.log("Autenticação pronta. ID do Usuário:", userId);

        // Carrega os dados e inicializa a UI APENAS após a autenticação e carregamento de dados
        await loadFirebaseData();
        initUI(); // Chamada para a nova função de inicialização da UI
    });

    // Configura tema inicial
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-mode', currentTheme === 'dark');
    document.querySelector('.theme-switcher').classList.toggle('dark', currentTheme === 'dark');

    // Carrega cores personalizadas
    const customColors = JSON.parse(localStorage.getItem('customColors')) || {};
    if (customColors.primary) {
        document.documentElement.style.setProperty('--primary-color', customColors.primary);
        document.documentElement.style.setProperty('--dark-primary-color', shadeColor(customColors.primary, -20));
    }
    if (customColors.secondary) {
        document.documentElement.style.setProperty('--secondary-color', customColors.secondary);
        document.documentElement.style.setProperty('--dark-secondary-color', shadeColor(customColors.secondary, -20));
    }
    if (customColors.danger) {
        document.documentElement.style.setProperty('--danger-color', customColors.danger);
        document.documentElement.style.setProperty('--dark-danger-color', shadeColor(customColors.danger, -20));
    }

    // Opções de cores
    const colorOptions = [
        { color: '#3498db', name: 'Azul' },
        { color: '#2ecc71', name: 'Verde' },
        { color: '#e74c3c', name: 'Vermelho' },
        { color: '#f39c12', name: 'Laranja' },
        { color: '#9b59b6', name: 'Roxo' },
        { color: '#1abc9c', name: 'Turquesa' },
        { color: '#34495e', name: 'Cinza Escuro' },
        { color: '#e67e22', name: 'Laranja Escuro' },
        { color: '#16a085', name: 'Verde Escuro' },
        { color: '#d35400', name: 'Laranja Queimado' },
        { color: '#8e44ad', name: 'Roxo Escuro' }
    ];

    // Funções de Inicialização da UI
    function initUI() {
        console.log("Inicializando interface do usuário...");
        initSuppliersButtons();
        renderTables();
        populateSupplierSelects();
        initSupplierList();
        setTimeout(updateScrollArrows, 100);
        attachEventListeners();
    }

    // Função para anexar todos os event listeners
    function attachEventListeners() {
        const settingsMenu = document.getElementById('settings-menu');
        const settingsBtn = document.getElementById('settings-btn');
        const supplierList = document.getElementById('supplier-list');
        const listToggle = document.getElementById('list-toggle');

        settingsBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            settingsMenu.classList.toggle('active');
        });

        document.getElementById('settings-menu-close').addEventListener('click', function () {
            settingsMenu.classList.remove('active');
        });

        document.addEventListener('click', function (e) {
            if (!supplierList.contains(e.target) && !listToggle.contains(e.target) && !settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
                supplierList.classList.remove('active');
                settingsMenu.classList.remove('active');
            }
        });

        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', function (e) {
                if (e.target === this) {
                    this.closest('.modal-overlay').classList.remove('active');
                }
                e.stopPropagation();
            });
        });

        supplierList.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', function () {
                const theme = this.dataset.theme;
                document.body.classList.toggle('dark-mode', theme === 'dark');
                document.querySelector('.theme-switcher').classList.toggle('dark', theme === 'dark');
                localStorage.setItem('theme', theme);
            });
        });

        document.getElementById('add-supplier-btn').addEventListener('click', function () {
            document.getElementById('add-supplier-modal').classList.add('active');
        });

        document.getElementById('add-supplier-btn-top').addEventListener('click', function () {
            document.getElementById('add-supplier-modal').classList.add('active');
        });

        document.getElementById('remove-supplier-btn').addEventListener('click', function () {
            populateSupplierSelects();
            document.getElementById('remove-supplier-modal').classList.add('active');
        });

        document.getElementById('change-colors-btn').addEventListener('click', function () {
            const primaryPicker = document.getElementById('primary-color-picker');
            const secondaryPicker = document.getElementById('secondary-color-picker');
            const dangerPicker = document.getElementById('danger-color-picker');

            primaryPicker.value = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
            secondaryPicker.value = getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim();
            dangerPicker.value = getComputedStyle(document.documentElement).getPropertyValue('--danger-color').trim();

            document.getElementById('primary-color-rectangle').style.backgroundColor = primaryPicker.value;
            document.getElementById('secondary-color-rectangle').style.backgroundColor = secondaryPicker.value;
            document.getElementById('danger-color-rectangle').style.backgroundColor = dangerPicker.value;

            ['primary', 'secondary', 'danger'].forEach(type => {
                const optionsContainer = document.getElementById(`${type}-color-options`);
                optionsContainer.innerHTML = '';
                colorOptions.forEach(opt => {
                    const div = document.createElement('div');
                    div.className = 'color-option';
                    div.style.backgroundColor = opt.color;
                    div.dataset.color = opt.color;
                    div.title = opt.name;
                    if (opt.color === document.getElementById(`${type}-color-picker`).value) {
                        div.classList.add('selected');
                    }
                    div.addEventListener('click', function () {
                        optionsContainer.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
                        this.classList.add('selected');
                        document.getElementById(`${type}-color-picker`).value = this.dataset.color;
                        document.getElementById(`${type}-color-rectangle`).style.backgroundColor = this.dataset.color;
                    });
                    optionsContainer.appendChild(div);
                });
            });

            document.getElementById('color-picker-modal').classList.add('active');
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', function () {
                this.closest('.modal-overlay').classList.remove('active');
            });
        });

        document.querySelectorAll('.btn-cancel').forEach(btn => {
            btn.addEventListener('click', function () {
                this.closest('.modal-overlay').classList.remove('active');
            });
        });

        document.getElementById('confirm-add-supplier').addEventListener('click', async function () {
            const name = document.getElementById('new-supplier-name').value.trim();
            const color = document.getElementById('new-supplier-color').value;
            const icon = document.getElementById('new-supplier-icon').value;

            if (name) {
                const supplierKey = name.toLowerCase().replace(/\s+/g, '-');

                if (suppliers[supplierKey]) {
                    showToast('Prestador já existe!', 'error');
                    return;
                }

                suppliers[supplierKey] = {
                    name: name,
                    color: color,
                    icon: icon,
                    data: []
                };

                await saveSupplierToFirestore(supplierKey, { name, color, icon });

                initSuppliersButtons();
                createSupplierForm(supplierKey);
                populateSupplierSelects();
                initSupplierList();
                updateScrollArrows();

                document.getElementById('add-supplier-modal').classList.remove('active');
                showToast(`Prestador "${name}" adicionado com sucesso!`, 'success');

                document.getElementById('add-supplier-form').reset();
                document.getElementById('new-supplier-color-rectangle').style.backgroundColor = '#3498db';
                document.getElementById('new-supplier-color').value = '#3498db';

                showSupplierForm(supplierKey);
            } else {
                showToast('Por favor, insira um nome para o prestador', 'error');
            }
        });

        document.querySelectorAll('#color-options .color-option').forEach(option => {
            option.addEventListener('click', function () {
                const color = this.dataset.color;
                document.getElementById('new-supplier-color').value = color;
                document.getElementById('new-supplier-color-rectangle').style.backgroundColor = color;
            });
        });

        document.getElementById('confirm-remove-supplier').addEventListener('click', async function () {
            const supplierKey = document.getElementById('supplier-to-remove').value;

            if (supplierKey) {
                await deleteSupplierFromFirestore(supplierKey);
                delete suppliers[supplierKey];

                document.querySelector(`.supplier-btn[data-supplier="${supplierKey}"]`)?.remove();
                document.getElementById(`${supplierKey}-form`)?.remove();

                initSupplierList();
                initSuppliersButtons();
                populateSupplierSelects();
                updateScrollArrows();

                document.getElementById('remove-supplier-modal').classList.remove('active');
                showToast('Prestador removido com sucesso!', 'success');
            } else {
                showToast('Por favor, selecione um prestador válido', 'error');
            }
        });

        document.getElementById('save-colors').addEventListener('click', async function () {
            const primaryColor = document.getElementById('primary-color-picker').value;
            const secondaryColor = document.getElementById('secondary-color-picker').value;
            const dangerColor = document.getElementById('danger-color-picker').value;

            document.documentElement.style.setProperty('--primary-color', primaryColor);
            document.documentElement.style.setProperty('--dark-primary-color', shadeColor(primaryColor, -20));
            document.documentElement.style.setProperty('--secondary-color', secondaryColor);
            document.documentElement.style.setProperty('--dark-secondary-color', shadeColor(secondaryColor, -20));
            document.documentElement.style.setProperty('--danger-color', dangerColor);
            document.documentElement.style.setProperty('--dark-danger-color', shadeColor(dangerColor, -20));

            await saveCustomColorsToFirestore({ primary: primaryColor, secondary: secondaryColor, danger: dangerColor });

            document.getElementById('color-picker-modal').classList.remove('active');
            showToast('Cores personalizadas salvas com sucesso!', 'success');
        });

        document.getElementById('reset-colors-btn').addEventListener('click', async function () {
            const defaultColors = {
                primary: '#3498db',
                secondary: '#2ecc71',
                danger: '#e74c3c'
            };

            document.getElementById('primary-color-picker').value = defaultColors.primary;
            document.getElementById('secondary-color-picker').value = defaultColors.secondary;
            document.getElementById('danger-color-picker').value = defaultColors.danger;

            document.getElementById('primary-color-rectangle').style.backgroundColor = defaultColors.primary;
            document.getElementById('secondary-color-rectangle').style.backgroundColor = defaultColors.secondary;
            document.getElementById('danger-color-rectangle').style.backgroundColor = defaultColors.danger;

            ['primary', 'secondary', 'danger'].forEach(type => {
                const optionsContainer = document.getElementById(`${type}-color-options`);
                optionsContainer.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.toggle('selected', opt.dataset.color === defaultColors[type]);
                });
            });

            await saveCustomColorsToFirestore(defaultColors);
            showToast('Cores redefinidas para o padrão!', 'success');
        });

        function smoothScroll(element, distance, duration) {
            const start = element.scrollLeft;
            const startTime = performance.now();

            function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = progress * (2 - progress);

                element.scrollLeft = start + distance * ease;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            }

            requestAnimationFrame(animate);
        }

        document.getElementById('scroll-left').addEventListener('click', function () {
            const scrollContainer = document.getElementById('suppliers-scroll');
            smoothScroll(scrollContainer, -150, 600);
        });

        document.getElementById('scroll-right').addEventListener('click', function () {
            const scrollContainer = document.getElementById('suppliers-scroll');
            smoothScroll(scrollContainer, 150, 600);
        });

        document.getElementById('suppliers-scroll').addEventListener('scroll', updateScrollArrows);

        document.getElementById('list-toggle').addEventListener('click', function (e) {
            e.stopPropagation();
            supplierList.classList.toggle('active');
        });

        document.getElementById('supplier-list-close').addEventListener('click', function () {
            supplierList.classList.remove('active');
        });
    }

    // Funções auxiliares
    function initSuppliersButtons() {
        const container = document.querySelector('.suppliers-scroll');
        container.innerHTML = '';

        for (const [key, supplier] of Object.entries(suppliers)) {
            const btn = document.createElement('button');
            btn.className = `supplier-btn ${key}`;
            btn.dataset.supplier = key;
            btn.style.backgroundColor = supplier.color;
            btn.style.color = '#ffffff';
            btn.innerHTML = `<i class="fas ${supplier.icon}"></i> ${supplier.name}`;

            btn.addEventListener('click', function () {
                showSupplierForm(key);
            });

            container.appendChild(btn);
        }
        updateScrollArrows();
    }

    function initSupplierList() {
        const list = document.getElementById('supplier-list');
        const header = list.querySelector('.supplier-list-header');
        while (list.children.length > 1) {
            list.removeChild(list.lastChild);
        }

        for (const [key, supplier] of Object.entries(suppliers)) {
            const item = document.createElement('div');
            item.className = 'supplier-list-item';
            item.dataset.supplier = key;
            item.innerHTML = `<i class="fas ${supplier.icon}"></i> ${supplier.name}`;

            item.addEventListener('click', function () {
                showSupplierForm(key);
                list.classList.remove('active');
            });

            list.appendChild(item);
        }
    }

    function updateScrollArrows() {
        const scrollContainer = document.getElementById('suppliers-scroll');
        const leftArrow = document.getElementById('scroll-left');
        const rightArrow = document.getElementById('scroll-right');

        const scrollLeft = scrollContainer.scrollLeft;
        const scrollWidth = scrollContainer.scrollWidth;
        const clientWidth = scrollContainer.clientWidth;

        leftArrow.style.display = scrollLeft > 0 ? 'flex' : 'none';
        rightArrow.style.display = scrollWidth > clientWidth && scrollLeft < (scrollWidth - clientWidth - 1) ? 'flex' : 'none';
    }

    function createSupplierForm(supplierKey) {
        const supplier = suppliers[supplierKey];
        if (!supplier) return;

        if (document.getElementById(`${supplierKey}-form`)) return;

        const formContainer = document.createElement('div');
        formContainer.id = `${supplierKey}-form`;
        formContainer.className = 'form-container';

        const formTitle = document.createElement('div');
        formTitle.className = 'form-title';
        formTitle.innerHTML = `<span><i class="fas ${supplier.icon}"></i> ${supplier.name} - Novo Lançamento</span>`;

        const form = document.createElement('form');
        form.id = `${supplierKey}Form`;
        form.autocomplete = 'off';

        const formRow = document.createElement('div');
        formRow.className = 'form-row';

        const typeGroup = document.createElement('div');
        typeGroup.className = 'form-group';
        typeGroup.innerHTML = `
            <label for="${supplierKey}-type">Empresa</label>
            <select id="${supplierKey}-type" required>
                <option value="">Selecione...</option>
                <option value="Matriz">Matriz</option>
                <option value="Filial">Filial</option>
                <option value="Kersis">Kersis</option>
            </select>
        `;

        const invoiceGroup = document.createElement('div');
        invoiceGroup.className = 'form-group';
        invoiceGroup.innerHTML = `
            <label for="${supplierKey}-invoice">Número da Fatura</label>
            <input type="text" id="${supplierKey}-invoice" required autocomplete="off">
        `;

        const dueGroup = document.createElement('div');
        dueGroup.className = 'form-group';
        dueGroup.innerHTML = `
            <label for="${supplierKey}-due">Vencimento</label>
            <input type="date" id="${supplierKey}-due" required autocomplete="off">
        `;

        const releaseGroup = document.createElement('div');
        releaseGroup.className = 'form-group';
        releaseGroup.innerHTML = `
            <label for="${supplierKey}-release">Registro</label>
            <input type="date" id="${supplierKey}-release" required autocomplete="off">
        `;

        const launchedGroup = document.createElement('div');
        launchedGroup.className = 'form-group-checkbox';
        launchedGroup.innerHTML = `
            <label for="${supplierKey}-launched">Lançada</label>
            <input type="checkbox" id="${supplierKey}-launched">
        `;

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-secondary form-submit-btn';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';

        formRow.appendChild(typeGroup);
        formRow.appendChild(invoiceGroup);
        formRow.appendChild(dueGroup);
        formRow.appendChild(releaseGroup);
        formRow.appendChild(launchedGroup);
        formRow.appendChild(submitBtn);
        form.appendChild(formRow);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';

        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-container';

        const typeFilterGroup = document.createElement('div');
        typeFilterGroup.className = 'filter-group';
        typeFilterGroup.innerHTML = `
            <label for="${supplierKey}-filter-type">Filtrar por Empresa</label>
            <select id="${supplierKey}-filter-type">
                <option value="">Todos</option>
                <option value="Matriz">Matriz</option>
                <option value="Filial">Filial</option>
                <option value="Kersis">Kersis</option>
            </select>
        `;

        const invoiceFilterGroup = document.createElement('div');
        invoiceFilterGroup.className = 'filter-group';
        invoiceFilterGroup.innerHTML = `
            <label for="${supplierKey}-filter-invoice">Filtrar por Número</label>
            <input type="text" id="${supplierKey}-filter-invoice" placeholder="Número da fatura" autocomplete="off">
        `;

        const dueFilterGroup = document.createElement('div');
        dueFilterGroup.className = 'form-group';
        dueFilterGroup.innerHTML = `
            <label for="${supplierKey}-filter-due">Filtrar por Vencimento</label>
            <input type="date" id="${supplierKey}-filter-due" autocomplete="off">
        `;

        const launchedFilterGroup = document.createElement('div');
        launchedFilterGroup.className = 'filter-group';
        launchedFilterGroup.innerHTML = `
            <label for="${supplierKey}-filter-launched">Filtrar por Lançada</label>
            <select id="${supplierKey}-filter-launched">
                <option value="">Todos</option>
                <option value="true">Lançada</option>
                <option value="false">Não Lançada</option>
            </select>
        `;

        const filterBtn = document.createElement('button');
        filterBtn.id = `${supplierKey}-filter-btn`;
        filterBtn.className = 'btn btn-secondary filter-btn';
        filterBtn.innerHTML = '<i class="fas fa-filter"></i> Filtrar';

        const clearFilterBtn = document.createElement('button');
        clearFilterBtn.id = `${supplierKey}-clear-filter-btn`;
        clearFilterBtn.className = 'btn btn-secondary filter-btn';
        clearFilterBtn.innerHTML = '<i class="fas fa-times"></i> Limpar Filtro';

        filterContainer.appendChild(typeFilterGroup);
        filterContainer.appendChild(invoiceFilterGroup);
        filterContainer.appendChild(dueFilterGroup);
        filterContainer.appendChild(launchedFilterGroup);
        filterContainer.appendChild(filterBtn);
        filterContainer.appendChild(clearFilterBtn);

        const table = document.createElement('table');
        table.id = `${supplierKey}-table`;
        table.innerHTML = `
            <thead>
                <tr>
                    <th style="width: 100px;">Lançada</th>
                    <th style="width: 120px;">Status</th>
                    <th>Empresa</th>
                    <th>Número da Fatura</th>
                    <th>Vencimento</th>
                    <th>Registro</th>
                    <th style="width: 120px;">Ações</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        tableContainer.appendChild(filterContainer);
        tableContainer.appendChild(table);

        formContainer.appendChild(formTitle);
        formContainer.appendChild(form);
        formContainer.appendChild(tableContainer);

        const suppliersContainer = document.querySelector('.suppliers-container');
        suppliersContainer.insertAdjacentElement('afterend', formContainer);

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            saveData(supplierKey);
        });

        filterBtn.addEventListener('click', function () {
            filterTable(supplierKey);
        });

        clearFilterBtn.addEventListener('click', function () {
            clearFilter(supplierKey);
        });

        renderTable(supplierKey);
    }

    function showSupplierForm(supplier) {
        document.querySelectorAll('.form-container').forEach(form => {
            form.classList.remove('active');
        });

        if (!document.getElementById(`${supplier}-form`)) {
            createSupplierForm(supplier);
        }

        const form = document.getElementById(`${supplier}-form`);
        if (form) {
            const suppliersContainer = document.querySelector('.suppliers-container');
            suppliersContainer.insertAdjacentElement('afterend', form);
            form.classList.add('active');
        }
    }

async function saveData(supplier) {
    const type = document.getElementById(`${supplier}-type`)?.value;
    const invoice = document.getElementById(`${supplier}-invoice`)?.value.trim();
    const due = document.getElementById(`${supplier}-due`)?.value;
    const release = document.getElementById(`${supplier}-release`)?.value;
    const launched = document.getElementById(`${supplier}-launched`)?.checked;

    if (type && invoice && due && release) {
        // Verificar se já existe uma fatura com o mesmo número para a mesma filial
        const duplicate = suppliers[supplier].data.some(item => 
            item.invoice === invoice && item.type === type
        );

        if (duplicate) {
            showToast('Já existe uma fatura com este número para esta filial!', 'error');
            return;
        }

        const newItem = {
            type,
            invoice,
            due,
            release,
            launched,
            timestamp: Date.now()
        };

        try {
            const docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/suppliers/${supplier}/data`), newItem);
            newItem.id = docRef.id;
            suppliers[supplier].data.push(newItem);
            renderTable(supplier);
            document.getElementById(`${supplier}Form`)?.reset();
            showToast('Lançamento salvo com sucesso!', 'success');
        } catch (error) {
            console.error("Erro ao salvar lançamento no Firestore:", error);
            showToast('Erro ao salvar lançamento!', 'error');
        }
    } else {
        showToast('Por favor, preencha todos os campos', 'error');
    }
}

    function renderTables() {
        for (const supplier in suppliers) {
            if (document.getElementById(`${supplier}-table`)) {
                renderTable(supplier);
            }
        }
    }

    function renderTable(supplier) {
        const tableBody = document.querySelector(`#${supplier}-table tbody`);
        if (!tableBody) return;

        tableBody.innerHTML = '';

        const sortedData = [...suppliers[supplier].data].sort((a, b) => b.timestamp - a.timestamp);

        sortedData.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id;

            const dueDate = new Date(item.due + 'T00:00:00');
            const releaseDate = new Date(item.release + 'T00:00:00');

            const formattedDue = dueDate.toLocaleDateString('pt-BR');
            const formattedRelease = releaseDate.toLocaleDateString('pt-BR');

            row.innerHTML = `
                <td>
                    <input type="checkbox" class="launched-checkbox" data-id="${item.id}" ${item.launched ? 'checked' : ''}>
                </td>
                <td>
                    <span class="status-badge ${item.launched ? 'lancado' : 'pendente'}">
                        ${item.launched ? 'Lançado' : 'Pendente'}
                    </span>
                </td>
                <td>${item.type}</td>
                <td>${item.invoice}</td>
                <td>${formattedDue}</td>
                <td>${formattedRelease}</td>
                <td class="action-buttons">
                    <button class="action-btn delete" data-id="${item.id}">
                        <i class="fas fa-trash"></i>
                        <span class="tooltip">Excluir</span>
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        document.querySelectorAll(`#${supplier}-table .delete`).forEach(btn => {
            btn.addEventListener('click', function () {
                showConfirmModal(
                    'Confirmar Exclusão',
                    'Tem certeza que deseja excluir este Registro?',
                    async () => {
                        await deleteEntry(supplier, this.dataset.id);
                    }
                );
            });
        });

        document.querySelectorAll(`#${supplier}-table .launched-checkbox`).forEach(checkbox => {
            checkbox.addEventListener('change', async function () {
                await updateLaunchedStatus(supplier, this.dataset.id, this.checked);
            });
        });
    }

    async function updateLaunchedStatus(supplier, id, launched) {
        suppliers[supplier].data = suppliers[supplier].data.map(item => {
            if (item.id == id) {
                return { ...item, launched };
            }
            return item;
        });

        try {
            const docRef = doc(db, `artifacts/${appId}/public/data/suppliers/${supplier}/data`, id);
            await updateDoc(docRef, { launched });

            const row = document.querySelector(`#${supplier}-table tr[data-id="${id}"]`);
            if (row) {
                const badge = row.querySelector('.status-badge');
                badge.className = launched ? 'status-badge lancado' : 'status-badge pendente';
                badge.textContent = launched ? 'Lançado' : 'Pendente';
            }

            showToast('Status de lançamento atualizado!', 'success');
        } catch (error) {
            console.error("Erro ao atualizar status no Firestore:", error);
            showToast('Erro ao atualizar status!', 'error');
        }
    }

    function filterTable(supplier) {
        const typeFilter = document.getElementById(`${supplier}-filter-type`)?.value;
        const invoiceFilter = document.getElementById(`${supplier}-filter-invoice`)?.value.toLowerCase() || '';
        const dueFilter = document.getElementById(`${supplier}-filter-due`)?.value;
        const launchedFilter = document.getElementById(`${supplier}-filter-launched`)?.value;

        const rows = document.querySelectorAll(`#${supplier}-table tbody tr`);

        rows.forEach(row => {
            const itemId = row.dataset.id;
            const item = suppliers[supplier].data.find(d => d.id === itemId);

            if (!item) {
                row.style.display = 'none';
                return;
            }

            const typeMatch = typeFilter === '' || item.type === typeFilter;
            const invoiceMatch = item.invoice.toLowerCase().includes(invoiceFilter);
            const dueMatch = !dueFilter || item.due === dueFilter;
            const launchedMatch = launchedFilter === '' || String(item.launched) === launchedFilter;

            row.style.display = typeMatch && invoiceMatch && dueMatch && launchedMatch ? '' : 'none';
        });
    }

    function clearFilter(supplier) {
        const typeInput = document.getElementById(`${supplier}-filter-type`);
        const invoiceInput = document.getElementById(`${supplier}-filter-invoice`);
        const dueInput = document.getElementById(`${supplier}-filter-due`);
        const launchedInput = document.getElementById(`${supplier}-filter-launched`);
        if (typeInput) typeInput.value = '';
        if (invoiceInput) invoiceInput.value = '';
        if (dueInput) dueInput.value = '';
        if (launchedInput) launchedInput.value = '';
        filterTable(supplier);
    }

    async function deleteEntry(supplier, id) {
        suppliers[supplier].data = suppliers[supplier].data.filter(item => item.id != id);

        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/suppliers/${supplier}/data`, id));
            renderTable(supplier);
            showToast('Lançamento excluído com sucesso!', 'success');
        } catch (error) {
            console.error("Erro ao excluir lançamento do Firestore:", error);
            showToast('Erro ao excluir lançamento!', 'error');
        }
    }

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast';
        toast.classList.add(type);
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    function showConfirmModal(title, message, confirmCallback) {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay active';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        modalHeader.innerHTML = `
            <h3 class="modal-title">${title}</h3>
            <button class="close-modal">×</button>
        `;

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        modalBody.innerHTML = `<p>${message}</p>`;

        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        modalFooter.innerHTML = `
            <button id="modal-cancel" class="btn btn-cancel">Cancelar</button>
            <button id="modal-confirm" class="btn btn-secondary">Confirmar</button>
        `;

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modalOverlay.appendChild(modalContent);

        document.body.appendChild(modalOverlay);

        const closeModal = () => document.body.removeChild(modalOverlay);

        modalOverlay.querySelector('.close-modal').addEventListener('click', closeModal);
        modalOverlay.querySelector('#modal-cancel').addEventListener('click', closeModal);

        modalOverlay.querySelector('#modal-confirm').addEventListener('click', function () {
            confirmCallback();
            closeModal();
        });

        modalOverlay.addEventListener('click', function (e) {
            if (e.target === this) {
                closeModal();
            }
            e.stopPropagation();
        });
    }

    function populateSupplierSelects() {
        const selects = [
            document.getElementById('supplier-to-remove')
        ];

        selects.forEach(select => {
            if (!select) return;

            select.innerHTML = '<option value="">Selecione...</option>';

            for (const [key, supplier] of Object.entries(suppliers)) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = supplier.name;
                select.appendChild(option);
            }
        });
    }

    function shadeColor(color, percent) {
        let R = parseInt(color.substring(1, 3), 16);
        let G = parseInt(color.substring(3, 5), 16);
        let B = parseInt(color.substring(5, 7), 16);

        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);

        R = (R < 255) ? R : 255;
        G = (G < 255) ? G : 255;
        B = (B < 255) ? B : 255;

        R = Math.round(R);
        G = Math.round(G);
        B = Math.round(B);

        const RR = ((R.toString(16).length == 1) ? "0" + R.toString(16) : R.toString(16));
        const GG = ((G.toString(16).length == 1) ? "0" + G.toString(16) : G.toString(16));
        const BB = ((B.toString(16).length == 1) ? "0" + B.toString(16) : B.toString(16));

        return "#" + RR + GG + BB;
    }

    async function loadFirebaseData() {
        if (!isAuthReady) {
            console.warn("Autenticação não está pronta. Não é possível carregar dados do Firebase.");
            return;
        }
        console.log("Carregando dados do Firebase da coleção pública...");
        try {
            const suppliersCollectionRef = collection(db, `artifacts/${appId}/public/data/suppliers`);
            const supplierSnapshot = await getDocs(suppliersCollectionRef);
            suppliers = {};
            for (const docSnapshot of supplierSnapshot.docs) {
                const supplierKey = docSnapshot.id;
                const supplierData = docSnapshot.data();
                suppliers[supplierKey] = {
                    name: supplierData.name,
                    color: supplierData.color,
                    icon: supplierData.icon,
                    data: []
                };

                const dataCollectionRef = collection(db, `artifacts/${appId}/public/data/suppliers/${supplierKey}/data`);
                const dataSnapshot = await getDocs(dataCollectionRef);
                dataSnapshot.forEach(dataDoc => {
                    suppliers[supplierKey].data.push({
                        id: dataDoc.id,
                        ...dataDoc.data()
                    });
                });
            }

            const customColorsDocRef = doc(db, `artifacts/${appId}/public/data/customColors`, 'appColors');
            const customColorsDoc = await getDoc(customColorsDocRef);
            if (customColorsDoc.exists()) {
                const customColors = customColorsDoc.data();
                document.documentElement.style.setProperty('--primary-color', customColors.primary);
                document.documentElement.style.setProperty('--dark-primary-color', shadeColor(customColors.primary, -20));
                document.documentElement.style.setProperty('--secondary-color', customColors.secondary);
                document.documentElement.style.setProperty('--dark-secondary-color', shadeColor(customColors.secondary, -20));
                document.documentElement.style.setProperty('--danger-color', customColors.danger);
                document.documentElement.style.setProperty('--dark-danger-color', shadeColor(customColors.danger, -20));
            }
            console.log("Dados do Firebase carregados com sucesso da coleção pública!");
        } catch (error) {
            console.error("Erro ao carregar dados do Firebase da coleção pública:", error);
            showToast('Erro ao carregar dados do Firebase. Verifique as regras de segurança do Firestore.', 'error');
        }
    }

    async function saveSupplierToFirestore(supplierKey, supplierData) {
        if (!isAuthReady) {
            showToast('Autenticação não está pronta. Tente novamente em breve.', 'error');
            return;
        }
        try {
            await setDoc(doc(db, `artifacts/${appId}/public/data/suppliers`, supplierKey), supplierData);
            console.log(`Prestador ${supplierKey} salvo no Firestore na coleção pública.`);
        } catch (error) {
            console.error("Erro ao salvar prestador no Firestore:", error);
            showToast('Erro ao salvar prestador.', 'error');
        }
    }

    async function deleteSupplierFromFirestore(supplierKey) {
        if (!isAuthReady) {
            showToast('Autenticação não está pronta. Tente novamente em breve.', 'error');
            return;
        }
        console.log(`Tentando excluir prestador: ${supplierKey}`);
        try {
            const dataCollectionRef = collection(db, `artifacts/${appId}/public/data/suppliers/${supplierKey}/data`);
            const dataSnapshot = await getDocs(dataCollectionRef);
            const batch = writeBatch(db);

            if (dataSnapshot.empty) {
                console.log(`Subcoleção 'data' para ${supplierKey} está vazia. Nenhuma fatura para excluir.`);
            } else {
                console.log(`Iniciando exclusão de ${dataSnapshot.docs.length} faturas para ${supplierKey}.`);
                dataSnapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`Todas as faturas para ${supplierKey} excluídas da subcoleção 'data' no Firestore.`);
            }

            await deleteDoc(doc(db, `artifacts/${appId}/public/data/suppliers`, supplierKey));
            console.log(`Documento do prestador ${supplierKey} excluído do Firestore.`);
            showToast('Prestador e todas as suas faturas removidos com sucesso!', 'success');
        } catch (error) {
            console.error(`Erro crítico ao excluir prestador ${supplierKey} do Firestore:`, error);
            showToast('Erro ao remover prestador e/ou faturas. Verifique o console.', 'error');
        }
    }

    async function saveCustomColorsToFirestore(colors) {
        if (!isAuthReady) {
            showToast('Autenticação não está pronta. Tente novamente em breve.', 'error');
            return;
        }
        try {
            await setDoc(doc(db, `artifacts/${appId}/public/data/customColors`, 'appColors'), colors);
            console.log("Cores personalizadas salvas no Firestore na coleção pública.");
        } catch (error) {
            console.error("Erro ao salvar cores personalizadas no Firestore:", error);
            showToast('Erro ao salvar cores personalizadas.', 'error');
        }
    }
});
