const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const filePreviewContainer = document.getElementById('file-preview-container');
const convertBtn = document.getElementById('convert-btn');
const clearBtn = document.getElementById('clear-btn');
const btnText = convertBtn.querySelector('span');
const btnIcon = convertBtn.querySelector('.btn-icon');

let selectedFiles = [];

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop zone
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

// Handle dropped files
dropZone.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

// Handle selected files from input
fileInput.addEventListener('change', function() {
    handleFiles(this.files);
    // Reset input so the same file can be selected again if removed
    this.value = '';
});

// Browse link click triggers input
document.querySelector('.browse-link').addEventListener('click', () => {
    fileInput.click();
});

function handleFiles(files) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'text/plain'];
    
    Array.from(files).forEach(file => {
        if (allowedTypes.includes(file.type)) {
            selectedFiles.push(file);
        } else {
            alert(`File type not supported: ${file.name}`);
        }
    });
    
    updateUI();
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateUI();
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function updateUI() {
    fileList.innerHTML = '';
    
    if (selectedFiles.length > 0) {
        filePreviewContainer.classList.remove('hidden');
        convertBtn.disabled = false;
        clearBtn.classList.remove('hidden');
        
        selectedFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            let thumbnail = '';
            if (file.type.startsWith('image/')) {
                const objectUrl = URL.createObjectURL(file);
                thumbnail = `<img src="${objectUrl}" class="file-thumbnail" alt="thumb">`;
            } else {
                thumbnail = `<div class="file-thumbnail">TXT</div>`;
            }
            
            li.innerHTML = `
                <div class="file-info">
                    ${thumbnail}
                    <div class="file-details">
                        <span class="file-name" title="${file.name}">${file.name}</span>
                        <span class="file-size">${formatBytes(file.size)}</span>
                    </div>
                </div>
                <button class="remove-btn" onclick="removeFile(${index})" title="Remove">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;
            fileList.appendChild(li);
        });
    } else {
        filePreviewContainer.classList.add('hidden');
        convertBtn.disabled = true;
        clearBtn.classList.add('hidden');
    }
}

clearBtn.addEventListener('click', () => {
    selectedFiles = [];
    updateUI();
});

// PDF Generation logic
convertBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;
    
    // Set loading state
    convertBtn.disabled = true;
    btnText.textContent = 'Converting...';
    btnIcon.classList.remove('hidden');
    
    try {
        const { jsPDF } = window.jspdf;
        // Create A4 PDF (210 x 297 mm)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const maxContentWidth = pageWidth - (margin * 2);
        const maxContentHeight = pageHeight - (margin * 2);
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            if (i > 0) {
                pdf.addPage();
            }
            
            if (file.type.startsWith('image/')) {
                await processImage(file, pdf, margin, maxContentWidth, maxContentHeight);
            } else if (file.type === 'text/plain') {
                await processText(file, pdf, margin, maxContentWidth, pageHeight);
            }
        }
        
        pdf.save('converted_documents.pdf');
        
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("An error occurred while generating the PDF.");
    } finally {
        // Reset state
        convertBtn.disabled = false;
        btnText.textContent = 'Convert to PDF';
        btnIcon.classList.add('hidden');
        
        // Clear files on success
        selectedFiles = [];
        updateUI();
    }
});

function processImage(file, pdf, margin, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgData = e.target.result;
            
            const img = new Image();
            img.onload = function() {
                // Calculate aspect ratio
                let imgWidth = img.width;
                let imgHeight = img.height;
                const ratio = imgWidth / imgHeight;
                
                // Scale down to fit max dimensions while preserving aspect ratio
                let finalWidth = maxWidth;
                let finalHeight = finalWidth / ratio;
                
                if (finalHeight > maxHeight) {
                    finalHeight = maxHeight;
                    finalWidth = finalHeight * ratio;
                }
                
                // Center the image
                const xOffset = margin + (maxWidth - finalWidth) / 2;
                const yOffset = margin + (maxHeight - finalHeight) / 2;
                
                pdf.addImage(imgData, file.type === 'image/png' ? 'PNG' : 'JPEG', xOffset, yOffset, finalWidth, finalHeight);
                resolve();
            };
            img.onerror = reject;
            img.src = imgData;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function processText(file, pdf, margin, maxWidth, pageHeight) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            pdf.setFontSize(12);
            
            // Split text to fit page width
            const textLines = pdf.splitTextToSize(text, maxWidth);
            
            let cursorY = margin + 5; // Start Y position
            const lineHeight = 6; // Approximate line height in mm
            
            for (let j = 0; j < textLines.length; j++) {
                if (cursorY + lineHeight > pageHeight - margin) {
                    pdf.addPage();
                    cursorY = margin + 5;
                }
                pdf.text(textLines[j], margin, cursorY);
                cursorY += lineHeight;
            }
            resolve();
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}
