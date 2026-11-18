
/* =========================================
   PETUALANGAN SANAK DIGITAL
   TIM BEDELAU - BANK INDONESIA RIAU

   File: script.js
   Backend: Google Apps Script
   Database: Google Sheets
   Storage: Google Drive
========================================= */


/* =========================================
   1. KONFIGURASI APLIKASI
========================================= */

const CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbzwJpK2bRKf6Ko4h_36v3wQ2FNZA_TSdKoc2KXJ5n1p7vusGk_Q7ibrnFEoLqrdZkfw/exec",

    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB sebelum kompresi
    MAX_IMAGE_SIZE: 1600,
    IMAGE_QUALITY: 0.72,

    ALLOWED_TYPES: [
        "image/jpeg",
        "image/png",
        "image/webp"
    ]
};


/* =========================================
   2. ELEMENT SELECTORS
========================================= */

const elements = {
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebarOverlay"),
    menuToggle: document.getElementById("menuToggle"),
    sidebarClose: document.getElementById("sidebarClose"),

    participantForm: document.getElementById("participantForm"),
    submitButton: document.getElementById("submitButton"),

    loadingOverlay: document.getElementById("loadingOverlay"),
    toastContainer: document.getElementById("toastContainer"),

    totalPeserta: document.getElementById("totalPeserta"),
    dataLengkap: document.getElementById("dataLengkap"),
    totalDokumentasi: document.getElementById("totalDokumentasi"),

    recentParticipants: document.getElementById("recentParticipants"),
    participantTable: document.getElementById("participantTable"),

    searchParticipant: document.getElementById("searchParticipant"),
    refreshData: document.getElementById("refreshData"),

    breadcrumbCurrent: document.getElementById("breadcrumbCurrent")
};


/* =========================================
   3. STATE APLIKASI
========================================= */

const state = {
    participants: [],
    isLoading: false,
    currentPage: "dashboard",
    searchKeyword: ""
};


/* =========================================
   4. KONSTANTA FOTO
========================================= */

const PHOTO_FIELDS = [
    {
        id: "fotoScan",
        preview: "previewScan",
        label: "Foto Saat Scan QRIS",
        key: "fotoScan"
    },
    {
        id: "fotoTransaksi",
        preview: "previewTransaksi",
        label: "Foto Bersama Bukti Transaksi QRIS",
        key: "fotoTransaksi"
    },
    {
        id: "fotoEdukasi",
        preview: "previewEdukasi",
        label: "Foto Saat Edukasi Peserta",
        key: "fotoEdukasi"
    },
    {
        id: "fotoPostTest",
        preview: "previewPostTest",
        label: "Bukti Pengerjaan Post Test",
        key: "fotoPostTest"
    },
    {
        id: "fotoSelesai",
        preview: "previewSelesai",
        label: "Bukti Selesai Post Test",
        key: "fotoSelesai"
    }
];


/* =========================================
   5. UTILITIES
========================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}


function formatNumber(number) {
    return new Intl.NumberFormat("id-ID").format(
        Number(number) || 0
    );
}


function formatDate(dateValue) {
    if (!dateValue) return "-";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}


function maskNIK(nik) {
    const value = String(nik || "");

    if (value.length !== 16) {
        return "-";
    }

    return value.slice(0, 4) + "********" + value.slice(-4);
}


function isValidPhone(phone) {
    return /^08[0-9]{8,13}$/.test(phone);
}


function isValidNIK(nik) {
    return /^[0-9]{16}$/.test(nik);
}


function isValidImage(file) {
    return file && CONFIG.ALLOWED_TYPES.includes(file.type);
}


/* =========================================
   6. TOAST NOTIFICATION
========================================= */

function showToast(message, type = "success") {
    if (!elements.toastContainer) return;

    const toast = document.createElement("div");

    toast.className = `toast ${type === "error" ? "error" : ""}`;

    const icon = type === "error"
        ? "fa-circle-exclamation"
        : "fa-circle-check";

    const title = type === "error"
        ? "Terjadi Kesalahan"
        : "Berhasil";

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>

        <div>
            <strong>${title}</strong>
            <span>${escapeHTML(message)}</span>
        </div>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4500);
}


/* =========================================
   7. LOADING OVERLAY
========================================= */

function setLoading(status, message = "Mohon tunggu, data sedang diproses.") {
    state.isLoading = status;

    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.toggle("active", status);

        const description = elements.loadingOverlay.querySelector("p");

        if (description) {
            description.textContent = message;
        }
    }

    if (elements.submitButton) {
        elements.submitButton.disabled = status;

        elements.submitButton.innerHTML = status
            ? `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`
            : `<i class="fa-solid fa-cloud-arrow-up"></i> Simpan Data Peserta`;
    }
}


/* =========================================
   8. SIDEBAR MOBILE
========================================= */

function openSidebar() {
    elements.sidebar?.classList.add("open");
    elements.sidebarOverlay?.classList.add("active");
}


function closeSidebar() {
    elements.sidebar?.classList.remove("open");
    elements.sidebarOverlay?.classList.remove("active");
}


elements.menuToggle?.addEventListener("click", openSidebar);

elements.sidebarClose?.addEventListener("click", closeSidebar);

elements.sidebarOverlay?.addEventListener("click", closeSidebar);


/* =========================================
   9. NAVIGASI HALAMAN
========================================= */

function navigateTo(page) {
    const validPages = [
        "dashboard",
        "tambah-peserta",
        "data-peserta",
        "tentang"
    ];

    if (!validPages.includes(page)) {
        page = "dashboard";
    }

    state.currentPage = page;

    // Sembunyikan semua halaman
    document.querySelectorAll(".page").forEach(section => {
        section.classList.remove("active");
    });

    // Tampilkan halaman yang dipilih
    const targetPage = document.getElementById(`page-${page}`);

    if (targetPage) {
        targetPage.classList.add("active");
    }

    // Update navigasi aktif
    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.toggle(
            "active",
            link.dataset.page === page
        );
    });

    // Update breadcrumb
    const pageNames = {
        "dashboard": "Dashboard",
        "tambah-peserta": "Tambah Peserta",
        "data-peserta": "Data Peserta",
        "tentang": "Tentang Aplikasi"
    };

    if (elements.breadcrumbCurrent) {
        elements.breadcrumbCurrent.textContent = pageNames[page];
    }

    // Update URL tanpa reload
    history.replaceState(null, "", `#${page}`);

    closeSidebar();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    // Ambil data ketika halaman data dibuka
    if (page === "data-peserta") {
        loadParticipants();
    }

    if (page === "dashboard") {
        updateDashboard();
    }
}


// Navigasi sidebar
document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();

        navigateTo(link.dataset.page);
    });
});


// Tombol navigasi di dalam halaman
document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.dataset.action);
    });
});


/* =========================================
   10. PREVIEW FOTO
========================================= */

const previewURLs = new Map();


function removePhotoPreview(inputId) {
    const previewElement = PHOTO_FIELDS.find(
        item => item.id === inputId
    );

    if (!previewElement) return;

    const previewContainer = document.getElementById(
        previewElement.preview
    );

    if (previewContainer) {
        previewContainer.innerHTML = "";
    }

    const oldURL = previewURLs.get(inputId);

    if (oldURL) {
        URL.revokeObjectURL(oldURL);
        previewURLs.delete(inputId);
    }

    const input = document.getElementById(inputId);

    if (input) {
        input.value = "";
    }
}


function showPhotoPreview(input) {
    const file = input.files?.[0];

    if (!file) return;

    const photo = PHOTO_FIELDS.find(
        item => item.id === input.id
    );

    if (!photo) return;

    const previewContainer = document.getElementById(
        photo.preview
    );

    if (!previewContainer) return;

    if (!isValidImage(file)) {
        showToast(
            "Format foto harus JPG, PNG, atau WEBP.",
            "error"
        );

        input.value = "";
        return;
    }

    if (file.size > CONFIG.MAX_FILE_SIZE) {
        showToast(
            "Ukuran foto maksimal 10 MB sebelum kompresi.",
            "error"
        );

        input.value = "";
        return;
    }

    // Hapus preview sebelumnya
    const oldURL = previewURLs.get(input.id);

    if (oldURL) {
        URL.revokeObjectURL(oldURL);
    }

    const imageURL = URL.createObjectURL(file);

    previewURLs.set(input.id, imageURL);

    previewContainer.innerHTML = `
        <div class="preview-item">

            <img
                src="${imageURL}"
                alt="Preview ${escapeHTML(photo.label)}"
            >

            <div class="preview-info">
                <strong>${escapeHTML(file.name)}</strong>

                <span>${formatFileSize(file.size)}</span>
            </div>

            <button
                type="button"
                class="preview-remove"
                data-remove-photo="${photo.id}"
                aria-label="Hapus foto"
            >
                <i class="fa-solid fa-trash"></i>
            </button>

        </div>
    `;
}


// Event upload foto
PHOTO_FIELDS.forEach(photo => {
    const input = document.getElementById(photo.id);

    input?.addEventListener("change", () => {
        showPhotoPreview(input);
    });
});


// Hapus foto dengan event delegation
document.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-photo]");

    if (!button) return;

    removePhotoPreview(button.dataset.removePhoto);
});


/* =========================================
   11. FORMAT UKURAN FOTO
========================================= */

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}


/* =========================================
   12. KOMPRESI FOTO
========================================= */

function compressImage(file) {
    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onerror = () => {
            reject(new Error("Gagal membaca file foto."));
        };

        reader.onload = () => {

            const image = new Image();

            image.onerror = () => {
                reject(new Error("File foto tidak dapat dibuka."));
            };

            image.onload = () => {

                const canvas = document.createElement("canvas");

                let width = image.width;
                let height = image.height;

                // Sesuaikan dimensi maksimal
                if (width > CONFIG.MAX_IMAGE_SIZE ||
                    height > CONFIG.MAX_IMAGE_SIZE) {

                    const ratio = Math.min(
                        CONFIG.MAX_IMAGE_SIZE / width,
                        CONFIG.MAX_IMAGE_SIZE / height
                    );

                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;

                const context = canvas.getContext("2d");

                if (!context) {
                    reject(new Error("Gagal memproses gambar."));
                    return;
                }

                context.fillStyle = "#FFFFFF";
                context.fillRect(0, 0, width, height);

                context.drawImage(
                    image,
                    0,
                    0,
                    width,
                    height
                );

                // Seluruh hasil dikonversi ke JPEG
                const compressedImage = canvas.toDataURL(
                    "image/jpeg",
                    CONFIG.IMAGE_QUALITY
                );

                if (!compressedImage.startsWith("data:image/jpeg;base64,")) {
                    reject(new Error("Gagal mengompres foto."));
                    return;
                }

                resolve({
                    data: compressedImage,
                    name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
                    size: Math.round(
                        (compressedImage.length - compressedImage.indexOf(",") - 1) * 0.75
                    )
                });

            };

            image.src = reader.result;
        };

        reader.readAsDataURL(file);
    });
}


/* =========================================
   13. AMBIL DATA FOTO
========================================= */

async function collectPhotos() {
    const photos = {};

    for (let i = 0; i < PHOTO_FIELDS.length; i++) {

        const field = PHOTO_FIELDS[i];

        const input = document.getElementById(field.id);

        const file = input?.files?.[0];

        if (!file) {
            throw new Error(
                `Foto "${field.label}" wajib diunggah.`
            );
        }

        if (!isValidImage(file)) {
            throw new Error(
                `Format foto "${field.label}" tidak valid.`
            );
        }

        if (file.size > CONFIG.MAX_FILE_SIZE) {
            throw new Error(
                `Foto "${field.label}" melebihi 10 MB.`
            );
        }

        const compressed = await compressImage(file);

        photos[field.key] = {
            name: compressed.name,
            mimeType: "image/jpeg",
            data: compressed.data
        };

    }

    return photos;
}


/* =========================================
   14. VALIDASI FORMULIR
========================================= */

function validateForm() {

    const nama = document.getElementById("nama")?.value.trim();
    const nik = document.getElementById("nik")?.value.trim();
    const nomorHp = document.getElementById("nomorHp")?.value.trim();
    const kota = document.getElementById("kota")?.value.trim();

    if (!nama || !nik || !nomorHp || !kota) {
        throw new Error(
            "Mohon lengkapi seluruh identitas peserta."
        );
    }

    if (!isValidNIK(nik)) {
        throw new Error(
            "NIK harus terdiri dari 16 digit angka."
        );
    }

    if (!isValidPhone(nomorHp)) {
        throw new Error(
            "Nomor HP harus diawali 08 dan terdiri dari 10–15 digit."
        );
    }

    if (nama.length < 3) {
        throw new Error(
            "Nama peserta minimal 3 karakter."
        );
    }

    return {
        nama,
        nik,
        nomorHp,
        kota
    };
}


/* =========================================
   15. KONFIGURASI GOOGLE APPS SCRIPT
========================================= */

function getAPIURL() {

    const url = CONFIG.API_URL.trim();

    if (
        !url.startsWith("https://script.google.com/macros/s/") ||
        !url.endsWith("/exec")
    ) {
        throw new Error(
            "URL Google Apps Script belum dikonfigurasi dengan benar."
        );
    }

    return url;
}


/* =========================================
   16. KIRIM DATA KE GOOGLE SHEETS
========================================= */

async function sendToGoogleSheets(payload) {

    const apiURL = getAPIURL();

    let response;

    try {

        response = await fetch(apiURL, {
            method: "POST",

            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },

            body: JSON.stringify(payload),

            redirect: "follow"
        });

    } catch (error) {

        throw new Error(
            "Tidak dapat menghubungi server. Periksa koneksi internet atau konfigurasi Apps Script."
        );

    }

    if (!response.ok) {
        throw new Error(
            `Server memberikan respons HTTP ${response.status}.`
        );
    }

    let result;

    try {
        result = await response.json();
    } catch (error) {
        throw new Error(
            "Respons server tidak dapat dibaca. Periksa konfigurasi Google Apps Script dan akses web app."
        );
    }

    if (!result.success) {
        throw new Error(
            result.message || "Gagal menyimpan data peserta."
        );
    }

    return result;
}


/* =========================================
   17. SUBMIT FORMULIR
========================================= */

async function handleFormSubmit(event) {

    event.preventDefault();

    if (state.isLoading) return;

    try {

        // 1. Validasi identitas
        const participant = validateForm();

        // 2. Kompresi dan kumpulkan lima foto
        setLoading(
            true,
            "Memeriksa dan mengompres lima foto dokumentasi..."
        );

        const photos = await collectPhotos();

        // 3. Siapkan payload
        const payload = {
            action: "create",

            participant: {
                ...participant
            },

            photos,

            clientTimestamp: new Date().toISOString()
        };

        // 4. Kirim ke backend
        setLoading(
            true,
            "Mengirim data dan foto ke Google Drive..."
        );

        const result = await sendToGoogleSheets(payload);

        // 5. Berhasil
        showToast(
            result.message || "Data peserta berhasil disimpan."
        );

        // 6. Reset formulir
        elements.participantForm.reset();

        PHOTO_FIELDS.forEach(photo => {
            const url = previewURLs.get(photo.id);

            if (url) {
                URL.revokeObjectURL(url);
                previewURLs.delete(photo.id);
            }

            const preview = document.getElementById(photo.preview);

            if (preview) {
                preview.innerHTML = "";
            }
        });

        // 7. Perbarui data dashboard
        await loadParticipants();

        // 8. Kembali ke dashboard
        navigateTo("dashboard");

    } catch (error) {

        console.error("Submit error:", error);

        showToast(
            error.message || "Terjadi kesalahan saat menyimpan data.",
            "error"
        );

    } finally {

        setLoading(false);

    }
}


elements.participantForm?.addEventListener(
    "submit",
    handleFormSubmit
);


/* =========================================
   18. AMBIL DATA DARI GOOGLE SHEETS
========================================= */

async function loadParticipants() {

    try {

        const apiURL = getAPIURL();

        const response = await fetch(
            `${apiURL}?action=list`,
            {
                method: "GET",
                redirect: "follow",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Gagal mengambil data. HTTP ${response.status}.`
            );
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(
                result.message || "Gagal memuat data peserta."
            );
        }

        state.participants = Array.isArray(result.data)
            ? result.data
            : [];

        updateDashboard();
        renderParticipants();

        return state.participants;

    } catch (error) {

        console.error("Load data error:", error);

        if (state.currentPage === "data-peserta") {
            showToast(
                error.message || "Gagal memuat data peserta.",
                "error"
            );
        }

        return [];

    }
}


/* =========================================
   19. UPDATE DASHBOARD
========================================= */

function updateDashboard() {

    const participants = state.participants;

    const total = participants.length;

    const complete = participants.filter(item => {
        return item.status === "Lengkap";
    }).length;

    const documentation = participants.reduce((sum, item) => {
        return sum + Number(item.jumlahFoto || 0);
    }, 0);

    if (elements.totalPeserta) {
        elements.totalPeserta.textContent = formatNumber(total);
    }

    if (elements.dataLengkap) {
        elements.dataLengkap.textContent = formatNumber(complete);
    }

    if (elements.totalDokumentasi) {
        elements.totalDokumentasi.textContent = formatNumber(documentation);
    }

    renderRecentParticipants();
}


/* =========================================
   20. RENDER PESERTA TERBARU
========================================= */

function renderRecentParticipants() {

    if (!elements.recentParticipants) return;

    const recent = [...state.participants]
        .sort((a, b) => {
            return new Date(b.timestamp || 0) -
                new Date(a.timestamp || 0);
        })
        .slice(0, 5);

    if (recent.length === 0) {

        elements.recentParticipants.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fa-solid fa-folder-open"></i>
                    <strong>Belum Ada Data Peserta</strong>
                    <span>Data peserta yang ditambahkan akan muncul di sini.</span>
                </td>
            </tr>
        `;

        return;
    }

    elements.recentParticipants.innerHTML = recent.map(item => {

        const status = item.status === "Lengkap"
            ? "complete"
            : "incomplete";

        const statusLabel = item.status === "Lengkap"
            ? "Lengkap"
            : "Belum Lengkap";

        return `
            <tr>
                <td>${escapeHTML(item.nama)}</td>
                <td>${escapeHTML(maskNIK(item.nik))}</td>
                <td>${escapeHTML(item.nomorHp)}</td>
                <td>${escapeHTML(item.kota)}</td>
                <td>
                    <span class="status-label ${status}">
                        ${statusLabel}
                    </span>
                </td>
            </tr>
        `;

    }).join("");

}


/* =========================================
   21. RENDER SELURUH PESERTA
========================================= */

function renderParticipants() {

    if (!elements.participantTable) return;

    const keyword = state.searchKeyword.toLowerCase();

    const filtered = state.participants.filter(item => {

        const nama = String(item.nama || "").toLowerCase();

        const nik = String(item.nik || "");

        const kota = String(item.kota || "").toLowerCase();

        return (
            nama.includes(keyword) ||
            nik.includes(keyword) ||
            kota.includes(keyword)
        );

    });

    if (filtered.length === 0) {

        elements.participantTable.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <strong>Data Tidak Ditemukan</strong>
                    <span>Coba gunakan kata kunci pencarian lain.</span>
                </td>
            </tr>
        `;

        return;
    }

    elements.participantTable.innerHTML = filtered.map((item, index) => {

        const status = item.status === "Lengkap"
            ? "complete"
            : "incomplete";

        const statusLabel = item.status === "Lengkap"
            ? "Lengkap"
            : "Belum Lengkap";

        return `
            <tr>

                <td>${index + 1}</td>

                <td>
                    <strong>${escapeHTML(item.nama)}</strong>
                </td>

                <td>${escapeHTML(maskNIK(item.nik))}</td>

                <td>${escapeHTML(item.nomorHp)}</td>

                <td>${escapeHTML(item.kota)}</td>

                <td>
                    <span class="status-label ${status}">
                        ${statusLabel}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="btn-outline detail-button"
                        data-participant-id="${escapeHTML(item.id)}"
                    >
                        <i class="fa-solid fa-eye"></i>
                        Detail
                    </button>
                </td>

            </tr>
        `;

    }).join("");

}


/* =========================================
   22. PENCARIAN PESERTA
========================================= */

elements.searchParticipant?.addEventListener("input", event => {

    state.searchKeyword = event.target.value.trim();

    renderParticipants();

});


/* =========================================
   23. REFRESH DATA
========================================= */

elements.refreshData?.addEventListener("click", async () => {

    const button = elements.refreshData;

    button.disabled = true;

    button.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Memuat...
    `;

    await loadParticipants();

    button.disabled = false;

    button.innerHTML = `
        <i class="fa-solid fa-rotate"></i>
        Refresh Data
    `;

    showToast("Data peserta telah diperbarui.");

});


/* =========================================
   24. RESET FORMULIR
========================================= */

elements.participantForm?.addEventListener("reset", () => {

    // Tunggu proses reset bawaan browser
    setTimeout(() => {

        PHOTO_FIELDS.forEach(photo => {

            const url = previewURLs.get(photo.id);

            if (url) {
                URL.revokeObjectURL(url);
                previewURLs.delete(photo.id);
            }

            const preview = document.getElementById(photo.preview);

            if (preview) {
                preview.innerHTML = "";
            }

        });

    }, 0);

});


/* =========================================
   25. NAVIGASI AWAL
========================================= */

function initializeNavigation() {

    const initialPage = location.hash.replace("#", "");

    const validPages = [
        "dashboard",
        "tambah-peserta",
        "data-peserta",
        "tentang"
    ];

    navigateTo(
        validPages.includes(initialPage)
            ? initialPage
            : "dashboard"
    );

}


/* =========================================
   26. INISIALISASI APLIKASI
========================================= */

async function initializeApp() {

    console.log(
        "Petualangan Sanak Digital - Tim Bedelau"
    );

    console.log(
        "Sistem pendataan berhasil dimuat."
    );

    initializeNavigation();

    // Muat data awal dari Google Sheets
    await loadParticipants();

}


// Jalankan aplikasi
document.addEventListener("DOMContentLoaded", initializeApp);
