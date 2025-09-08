let originalSymbolIndices = [], modulatedSymbols = [], currentModulation = 'QPSK';
let zfResults = null, mmseResults = null;
let distortedSymbols = [], currentNt = 2, currentNr = 2;

let serChart = null;
const savedCurves = [];
const maxCurves = 5;

let constellationCharts = {};

// --- COMPLEX NUMBER CLASS ---
class Complex {
    constructor(r, i = 0) {
        this.real = r;
        this.imag = i;
    }
    add(o) {
        return new Complex(this.real + o.real, this.imag + o.imag);
    }
    subtract(o) {
        return new Complex(this.real - o.real, this.imag - o.imag);
    }
    multiply(o) {
        if (typeof o === 'number') return new Complex(this.real * o, this.imag * o);
        return new Complex(this.real * o.real - this.imag * o.imag, this.real * o.imag + this.imag * o.real);
    }
    divide(o) {
        const d = o.real * o.real + o.imag * o.imag;
        if (d === 0) return new Complex(Infinity, Infinity);
        return new Complex((this.real * o.real + this.imag * o.imag) / d, (this.imag * o.real - this.real * o.imag) / d);
    }
    conjugate() {
        return new Complex(this.real, -this.imag);
    }
    magnitudeSq() {
        return this.real * this.real + this.imag * this.imag;
    }
    toString(p = 2) {
        return `${this.real.toFixed(p)}${this.imag >= 0 ? '+' : ''}${this.imag.toFixed(p)}j`;
    }
}

// --- MODULATION CONSTANTS ---
const constellations = {
    BPSK: [new Complex(-1, 0), new Complex(1, 0)],
    QPSK: (() => {
        const p = [new Complex(1, 1), new Complex(-1, 1), new Complex(-1, -1), new Complex(1, -1)];
        const avg_pwr = p.reduce((s, v) => s + v.magnitudeSq(), 0) / p.length;
        return p.map(c => c.multiply(1 / Math.sqrt(avg_pwr)));
    })(),
    '16QAM': (() => {
        const p = [];
        for (let i of [-3, -1, 1, 3])
            for (let q of [-3, -1, 1, 3])
                p.push(new Complex(i, q));
        const avg_pwr = p.reduce((s, v) => s + v.magnitudeSq(), 0) / p.length;
        return p.map(c => c.multiply(1 / Math.sqrt(avg_pwr)));
    })(),
    '64QAM': (() => {
        const p = [];
        for (let i of [-7, -5, -3, -1, 1, 3, 5, 7])
            for (let q of [-7, -5, -3, -1, 1, 3, 5, 7])
                p.push(new Complex(i, q));
        const avg_pwr = p.reduce((s, v) => s + v.magnitudeSq(), 0) / p.length;
        return p.map(c => c.multiply(1 / Math.sqrt(avg_pwr)));
    })()
};

// --- UI & CONTROL FUNCTIONS ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeSERChart();
        resetSignalFlow();
        
        const tabEl = document.querySelector('#myTab .nav-link');
        if (tabEl) {
            const tab = new bootstrap.Tab(tabEl);
            tab.show();
        }
        
        const analysisElements = [
            'analysisNumTxAntennas',
            'analysisNumRxAntennas', 
            'analysisModulation',
            'channelConditionFactor'  // Updated name
        ];

        analysisElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    if (savedCurves.length > 0) updateAnalysisChart();
                });
            }
        });

        document.querySelectorAll('input[name="analysisTechnique"]').forEach(radio => {
            radio.addEventListener('change', () => {
                updateChannelConditionVisibility();
                if (savedCurves.length > 0) updateAnalysisChart();
            });
        });

        // Initial setup - always show since both equalizers are affected
        updateChannelConditionVisibility();
        
        analysisElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    if (savedCurves.length > 0) updateAnalysisChart();
                });
            }
        });
        
        document.querySelectorAll('input[name="analysisTechnique"]').forEach(radio => {
            radio.addEventListener('change', () => {
                updateNoiseAmplificationVisibility();
                if (savedCurves.length > 0) updateAnalysisChart();
            });
        });

        // Initial setup for the performance tab
        updateNoiseAmplificationVisibility();
    } catch (error) {
        console.error('Initialization error:', error);
    }
});


function updateChannelConditionVisibility() {
    // Always show the channel condition factor for both ZF and MMSE
    const channelCondGroup = document.getElementById('channelConditionGroup');
    if (channelCondGroup) {
        channelCondGroup.style.display = 'flex';
    }
}


function generateRandomSymbols() {
    currentModulation = document.getElementById('modulationScheme').value;
    currentNt = parseInt(document.getElementById('numTxAntennas').value);
    currentNr = parseInt(document.getElementById('numRxAntennas').value);
    const constPoints = constellations[currentModulation];
    originalSymbolIndices = [];
    modulatedSymbols = [];
    for (let i = 0; i < currentNt; i++) {
        const idx = Math.floor(Math.random() * constPoints.length);
        originalSymbolIndices.push(idx);
        modulatedSymbols.push(constPoints[idx]);
    }
}

async function runSimulation() {
    document.getElementById('loadingIndicator').style.display = 'flex';
    document.getElementById('simulateBtn').disabled = true;
    document.getElementById('regenerateBtn').disabled = true;
    
    await new Promise(resolve => setTimeout(resolve, 10));

    try {
        generateRandomSymbols();
        const Nt = currentNt;
        const Nr = currentNr;

        const snr_dB = parseFloat(document.getElementById('snrInput').value);
        const constPoints = constellations[currentModulation];
        const E_avg = constPoints.reduce((s, v) => s + v.magnitudeSq(), 0) / constPoints.length;
        const noiseVariance = E_avg / (10 ** (snr_dB / 10));

        const H = generateComplexChannel(Nr, Nt);
        await new Promise(resolve => setTimeout(resolve, 1));
        
        const receivedSymbols = multiplyMatrixVector(H, modulatedSymbols);
        const noise = Array.from({ length: Nr }, () => generateComplexGaussian().multiply(Math.sqrt(noiseVariance)));
        const noisyReceivedSymbols = receivedSymbols.map((s, i) => s.add(noise[i]));
        distortedSymbols = noisyReceivedSymbols.slice();

        await new Promise(resolve => setTimeout(resolve, 1));
        const condNum = calculateConditionNumber(H);

        await new Promise(resolve => setTimeout(resolve, 1));
        let zf_eq_data, mmse_eq_data;

        // ZF Equalization
        let W_zf = null;
        const H_H_zf = transposeConjugateMatrix(H);
        if (Nr >= Nt) {
            const H_H_H_zf = multiplyComplexMatrices(H_H_zf, H);
            const H_inv_zf = invertMatrix(H_H_H_zf);
            if (H_inv_zf) W_zf = multiplyComplexMatrices(H_inv_zf, H_H_zf);
        } else {
            const H_H_H_zf = multiplyComplexMatrices(H, H_H_zf);
            const H_inv_zf = invertMatrix(H_H_H_zf);
            if (H_inv_zf) W_zf = multiplyComplexMatrices(H_H_zf, H_inv_zf);
        }
        zf_eq_data = W_zf ? multiplyMatrixVector(W_zf, noisyReceivedSymbols) : [];

        // MMSE Equalization
        let W_mmse = null;
        const H_H_mmse = transposeConjugateMatrix(H);
        if (Nr >= Nt) {
            const H_H_H_mmse = multiplyComplexMatrices(H_H_mmse, H);
            const I = identityMatrix(Nt);
            const noiseTerm = multiplyMatrixScalar(I, noiseVariance / E_avg);
            const mmse_inv = invertMatrix(addMatrices(H_H_H_mmse, noiseTerm));
            if (mmse_inv) W_mmse = multiplyComplexMatrices(mmse_inv, H_H_mmse);
        } else {
            const H_H_H_mmse = multiplyComplexMatrices(H, H_H_mmse);
            const I = identityMatrix(Nr);
            const noiseTerm = multiplyMatrixScalar(I, noiseVariance / E_avg);
            const mmse_inv = invertMatrix(addMatrices(H_H_H_mmse, noiseTerm));
            if (mmse_inv) W_mmse = multiplyComplexMatrices(H_H_mmse, mmse_inv);
        }
        mmse_eq_data = W_mmse ? multiplyMatrixVector(W_mmse, noisyReceivedSymbols) : [];


        await new Promise(resolve => setTimeout(resolve, 1));
        const zf_demod = demodulate(zf_eq_data, currentModulation);
        const mmse_demod = demodulate(mmse_eq_data, currentModulation);

        zfResults = {
            equalized: zf_eq_data,
            ser: calculateSER(originalSymbolIndices, zf_demod.indices),
            errors: zf_demod.indices.filter((s, i) => s !== originalSymbolIndices[i]).length,
            conditionNumber: condNum,
            demodulatedIndices: zf_demod.indices
        };
        
        mmseResults = {
            equalized: mmse_eq_data,
            ser: calculateSER(originalSymbolIndices, mmse_demod.indices),
            errors: mmse_demod.indices.filter((s, i) => s !== originalSymbolIndices[i]).length,
            conditionNumber: condNum,
            demodulatedIndices: mmse_demod.indices
        };

        document.getElementById('techniqueSelector').style.display = 'block';
        document.getElementById('resultsContainer').style.display = 'block';
        document.getElementById('constellationSection').style.display = 'block';
        document.getElementById('simulateBtn').style.display = 'none';
        document.getElementById('regenerateBtn').style.display = 'block';

        await new Promise(resolve => setTimeout(resolve, 5));
        updateSignalFlow(H, noisyReceivedSymbols);
        
        await new Promise(resolve => setTimeout(resolve, 5));
        updateDisplay();
        
        await new Promise(resolve => setTimeout(resolve, 5));
        updateConstellationPlots();

    } catch (error) {
        console.error('Simulation error:', error);
        alert('Simulation failed. Please try again.');
    } finally {
        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('simulateBtn').disabled = false;
        document.getElementById('regenerateBtn').disabled = false;
    }
}

function updateDisplay() {
    const t = document.querySelector('input[name="technique"]:checked').value;
    const r = (t === 'ZF') ? zfResults : mmseResults;
    if (!r) return;

    document.getElementById('serValue').innerText = r.ser.toFixed(3);
    document.getElementById('errorCount').innerText = `${r.errors} / ${originalSymbolIndices.length}`;
    document.getElementById('conditionNumber').innerText = r.conditionNumber.toFixed(2);

    const equalizedPlot = document.getElementById('equalizedPlot');
    if (equalizedPlot) {
        equalizedPlot.querySelector('h5').innerText = `Equalized (${t})`;
    }

    const eqBlock = document.getElementById('flow-equalized');
    if (eqBlock) {
        const eqData = r.equalized.length > 0 ? r.equalized.map(s => s.toString(2)).join('<br>') : 'Equalization failed';
        eqBlock.innerHTML = `<h4>${t} Equalized (x̂)</h4><div class="signal-value">${eqData}</div>`;
    }
    
    const demodedBlock = document.getElementById('flow-demodulated');
    if (demodedBlock) {
        const demodedData = r.demodulatedIndices.length > 0 ? r.demodulatedIndices.map(i => `Symbol ${i}`).join('<br>') : 'Demodulation failed';
        demodedBlock.innerHTML = `<h4>MAP Detector</h4><div class="signal-value" id="demodulatedOutput">${demodedData}<br><small>(${r.errors} errors)</small></div>`;
    }

    updateConstellationPlots();
}

function updateSignalFlow(channelMatrix, noisyReceivedSymbols) {
    const Nt = currentNt;
    const Nr = currentNr;
    document.getElementById('signalFlow').innerHTML = `
        <div class="signal-block"><h4>Transmitted (x)</h4><div class="signal-value">${modulatedSymbols.map(s => s.toString(2)).join('<br>')}<br><small>${Nt} streams</small></div></div>
        <div class="arrow">→</div>
        <div class="signal-block"><h4>Channel (H)</h4><div class="signal-value">${Nr}×${Nt} MIMO<br><small>Rayleigh fading</small></div></div>
        <div class="arrow">→</div>
        <div class="noise-adder">
            <div class="noise-adder-circle">+</div>
            <div class="noise-arrow">↑</div>
            <div class="noise-adder-label">AWGN</div>
        </div>
        <div class="arrow">→</div>
        <div class="signal-block"><h4>Received (y)</h4><div class="signal-value">${noisyReceivedSymbols.map(s => s.toString(2)).join('<br>')}<br><small>${Nr} antennas</small></div></div>
        <div class="arrow">→</div>
        <div class="signal-block" id="flow-equalized"></div>
        <div class="arrow">→</div>
        <div class="signal-block" id="flow-demodulated"></div>
    `;
    updateDisplay();
}

function resetSignalFlow() {
    document.getElementById('signalFlow').innerHTML = '<div class="signal-block" style="width:100%"><h4>MIMO Simulation Flow</h4><div class="signal-value" style="text-align:center; padding-top:20px;">Configure MIMO parameters and click "Simulate Channel" to begin.</div></div>';
}

// --- CORE LOGIC & MATH ---
function generateComplexGaussian() {
    const u1 = Math.random(),
        u2 = Math.random();
    return new Complex(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) / Math.sqrt(2), Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2) / Math.sqrt(2));
}

function generateComplexChannel(Nr, Nt) {
    return Array.from({
        length: Nr
    }, () => Array.from({
        length: Nt
    }, () => generateComplexGaussian()));
}

function demodulate(r, m) {
    const c = constellations[m];
    if (!r || r.length === 0 || !c) return {
        indices: [],
        symbols: []
    };
    const i = r.map(s => {
        let best = 0,
            min = Infinity;
        for (let j = 0; j < c.length; j++) {
            const d = s.subtract(c[j]).magnitudeSq();
            if (d < min) {
                min = d;
                best = j;
            }
        }
        return best;
    });
    return {
        indices: i,
        symbols: i.map(j => c[j])
    };
}

function calculateSER(originalIndices, demodulatedIndices) {
    if (!originalIndices || !demodulatedIndices || 
        originalIndices.length === 0 || demodulatedIndices.length === 0 || 
        originalIndices.length !== demodulatedIndices.length) {
        return 1.0; 
    }
    
    let errorCount = 0;
    for (let i = 0; i < originalIndices.length; i++) {
        if (originalIndices[i] !== demodulatedIndices[i]) {
            errorCount++;
        }
    }
    
    return errorCount / originalIndices.length;
}

function calculateConditionNumber(H) {
    const H_H = transposeConjugateMatrix(H);
    const HHH = multiplyComplexMatrices(H_H, H);
    let trace = 0;
    let minDiag = Infinity;
    for (let i = 0; i < Math.min(HHH.length, HHH[0].length); i++) {
        const diagVal = HHH[i][i].magnitudeSq();
        trace += Math.sqrt(diagVal);
        if (Math.sqrt(diagVal) < minDiag) minDiag = Math.sqrt(diagVal);
    }
    return minDiag > 0 ? trace / (HHH.length * minDiag) : Infinity;
}

// --- COMPLEX MATRIX ALGEBRA ---
function multiplyMatrixVector(m, v) {
    return m.map(r => r.reduce((a, c, j) => a.add(c.multiply(v[j])), new Complex(0, 0)));
}

function multiplyComplexMatrices(A, B) {
    const C = Array(A.length).fill(0).map(() => Array(B[0].length).fill(new Complex(0, 0)));
    for (let i = 0; i < A.length; i++)
        for (let j = 0; j < B[0].length; j++)
            for (let k = 0; k < A[0].length; k++)
                C[i][j] = C[i][j].add(A[i][k].multiply(B[k][j]));
    return C;
}

function transposeConjugateMatrix(m) {
    const r = Array(m[0].length).fill(0).map(() => Array(m.length));
    for (let i = 0; i < m.length; i++)
        for (let j = 0; j < m[0].length; j++)
            r[j][i] = m[i][j].conjugate();
    return r;
}

function addMatrices(A, B) {
    return A.map((r, i) => r.map((v, j) => v.add(B[i][j])));
}

function multiplyMatrixScalar(m, s) {
    return m.map(r => r.map(v => v.multiply(s)));
}

function identityMatrix(s) {
    const I = Array(s).fill(0).map(() => Array(s).fill(new Complex(0, 0)));
    for (let i = 0; i < s; i++) I[i][i] = new Complex(1, 0);
    return I;
}

// --- IMPROVED MATRIX INVERSION WITH BETTER NUMERICAL STABILITY (Gaussian elimination) ---
function invertMatrix(m) {
    const n = m.length;
    if (n === 0) return null;
    
    // Create augmented matrix [A | I]
    const A = m.map((r, i) => [...r.map(c => new Complex(c.real, c.imag)), ...identityMatrix(n)[i]]);
    
    const eps = 1e-10; // Numerical precision threshold
    
    for (let i = 0; i < n; i++) {
        // Find pivot
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (A[k][i].magnitudeSq() > A[maxRow][i].magnitudeSq()) {
                maxRow = k;
            }
        }
        
        // Check for singular matrix
        if (A[maxRow][i].magnitudeSq() < eps) {
            console.warn('Matrix is singular or near-singular');
            return null;
        }
        
        // Swap rows
        [A[i], A[maxRow]] = [A[maxRow], A[i]];
        
        // Scale pivot row
        const pivot = A[i][i];
        for (let j = i; j < 2 * n; j++) {
            A[i][j] = A[i][j].divide(pivot);
        }
        
        // Eliminate column
        for (let k = 0; k < n; k++) {
            if (k !== i) {
                const factor = A[k][i];
                for (let j = i; j < 2 * n; j++) {
                    A[k][j] = A[k][j].subtract(factor.multiply(A[i][j]));
                }
            }
        }
    }
    
    return A.map(r => r.slice(n));
}

// --- PSEUDO-INVERSE FOR NON-SQUARE MATRICES ---
function pseudoInverse(H) {
    const Nr = H.length;
    const Nt = H[0].length;
    const H_H = transposeConjugateMatrix(H);
    
    if (Nr >= Nt) { // Tall matrix, H^+ = (H^H H)^-1 H^H
        const H_H_H = multiplyComplexMatrices(H_H, H);
        const inv_term = invertMatrix(H_H_H);
        if (!inv_term) return null;
        return multiplyComplexMatrices(inv_term, H_H);
    } else { // Wide matrix, H^+ = H^H (H H^H)^-1
        const H_H_H = multiplyComplexMatrices(H, H_H);
        const inv_term = invertMatrix(H_H_H);
        if (!inv_term) return null;
        return multiplyComplexMatrices(H_H, inv_term);
    }
}

async function calculateSERvsSNR(mod, Nt, Nr, equalizer, channelConditionFactor = 1.0) {
    const numSymbolsPerSNR = 10000;
    const snr_dB = Array.from({ length: 26 }, (_, i) => -5 + i * 1);
    
    const c = constellations[mod];
    const E_avg = c.reduce((s, v) => s + v.magnitudeSq(), 0) / c.length;
    
    const serData = [];
    
    for (const db of snr_dB) {
        const snr_linear = 10 ** (db / 10);
        const baseNoiseVariance = 1 / snr_linear;
        
        let errorCount = 0;
        let totalSymbols = 0;
        const numberOfTransmissions = Math.floor(numSymbolsPerSNR / Nt);

        for (let t = 0; t < numberOfTransmissions; t++) {
            // Generate Rayleigh fading channel with condition factor
            const H = generateRayleighChannel(Nr, Nt, channelConditionFactor);
            
            const originalIndices = Array.from({ length: Nt }, () => Math.floor(Math.random() * c.length));
            const modulated_symbols = originalIndices.map(i => c[i]);
            
            let y = multiplyMatrixVector(H, modulated_symbols);
            
            // Add AWGN noise
            const noise_vector = Array.from({ length: Nr }, () => 
                generateComplexGaussian().multiply(Math.sqrt(baseNoiseVariance / 2))
            );
            
            const noisy_y = y.map((s, i) => s.add(noise_vector[i]));

            let W = null;
            let equalized_symbols = [];

            if (equalizer === 'ZF') {
                // ZF: W = H^+ (pseudo-inverse)
                // Noise enhancement occurs naturally due to H^+ characteristics
                W = pseudoInverse(H);
            } else if (equalizer === 'MMSE') {
                // MMSE: W = (H^H*H + σ²I)^(-1) * H^H
                // Channel condition factor affects the regularization
                const H_H = transposeConjugateMatrix(H);
                const H_H_H = multiplyComplexMatrices(H_H, H);
                const I_term = identityMatrix(Nt);
                const regularization = baseNoiseVariance / channelConditionFactor; // Better conditioning with higher factor
                const MMSE_term = multiplyMatrixScalar(I_term, regularization);
                const MMSE_matrix = addMatrices(H_H_H, MMSE_term);
                const inv_MMSE = invertMatrix(MMSE_matrix);
                if (inv_MMSE) {
                    W = multiplyComplexMatrices(inv_MMSE, H_H);
                }
            }
            
            if (W) {
                equalized_symbols = multiplyMatrixVector(W, noisy_y);
            }
            
            const demodulatedIndices = demodulate(equalized_symbols, mod).indices;

            for (let i = 0; i < Nt; i++) {
                if (originalIndices[i] !== demodulatedIndices[i]) {
                    errorCount++;
                }
            }
            totalSymbols += Nt;
        }
        
        const ser = totalSymbols > 0 ? errorCount / totalSymbols : 1.0;
        serData.push(Math.max(ser, 0.0001));
    }
    
    const conditionLabel = (channelConditionFactor !== 1.0) ? ` (η=${channelConditionFactor})` : '';
    return { 
        labels: snr_dB, 
        data: serData, 
        label: `${mod} ${Nt}x${Nr} (${equalizer}${conditionLabel})` 
    };
}

async function addSERCurve() {
    if (savedCurves.length >= maxCurves) {
        alert(`You can only plot up to ${maxCurves} configurations. Please reset the plots to add more.`);
        return;
    }

    document.getElementById('chartLoadingIndicator').style.display = 'flex';
    document.getElementById('plotConfigBtn').disabled = true;
    document.getElementById('resetPlotsBtn').disabled = true;

    try {
        const mod = document.getElementById('analysisModulation').value;
        const Nt = parseInt(document.getElementById('analysisNumTxAntennas').value);
        const Nr = parseInt(document.getElementById('analysisNumRxAntennas').value);
        const equalizer = document.querySelector('input[name="analysisTechnique"]:checked').value;
        const channelConditionFactor = parseFloat(document.getElementById('channelConditionFactor').value);

        const newCurve = await calculateSERvsSNR(mod, Nt, Nr, equalizer, channelConditionFactor);
        savedCurves.push(newCurve);
        updateAnalysisChart();
    } catch (error) {
        console.error('Error generating curve:', error);
        alert('An error occurred while generating the curve. Please check the console for details.');
    } finally {
        document.getElementById('chartLoadingIndicator').style.display = 'none';
        document.getElementById('plotConfigBtn').disabled = false;
        document.getElementById('resetPlotsBtn').disabled = false;
    }
}

function resetSERChart() {
    savedCurves.length = 0;
    updateAnalysisChart();
}

const predefinedColors = [
    '#0d6efd', '#28a745', '#e74c3c', '#ffc107', '#6c757d'
];

function updateAnalysisChart() {
    if (serChart) serChart.destroy();
    const ctx = document.getElementById('serChart').getContext('2d');
    
    const datasets = savedCurves.map((curve, index) => ({
        label: curve.label,
        data: curve.data,
        borderColor: predefinedColors[index % predefinedColors.length],
        backgroundColor: predefinedColors[index % predefinedColors.length],
        fill: false,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2
    }));
    
    // Calculate dynamic y-axis limits
    const yAxisLimits = calculateDynamicYAxisLimits(datasets);
    const tickInfo = getDynamicTickLabels(yAxisLimits.min, yAxisLimits.max);
    
    serChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: savedCurves.length > 0 ? savedCurves[0].labels : [],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,
            layout: { padding: 10 },
            scales: {
                y: {
                    type: 'logarithmic',
                    title: { display: true, text: 'Symbol Error Rate (SER)' },
                    min: yAxisLimits.min,
                    max: yAxisLimits.max,
                    ticks: { 
                        callback: function(v, i, ticks) {
                            const value = Number(v);
                            // Only show labels for our dynamic tick values
                            const index = tickInfo.values.findIndex(val => Math.abs(val - value) < 1e-10);
                            return index !== -1 ? tickInfo.labels[index] : '';
                        },
                        color: '#555',
                        font: { size: 10 },
                        maxTicksLimit: tickInfo.values.length + 1
                    },
                    grid: { 
                        color: function(context) {
                            const value = context.tick.value;
                            // Highlight grid lines for our dynamic tick values
                            if (tickInfo.values.some(val => Math.abs(val - value) < 1e-10)) {
                                return 'rgba(0,0,0,0.3)';
                            }
                            return 'rgba(0,0,0,0.1)';
                        },
                        lineWidth: function(context) {
                            const value = context.tick.value;
                            if (tickInfo.values.some(val => Math.abs(val - value) < 1e-10)) {
                                return 1;
                            }
                            return 0.5;
                        }
                    }
                },
                x: {
                    title: { display: true, text: 'Average SNR (dB)' },
                    min: -5,
                    max: 20,
                    ticks: {
                        stepSize: 5,
                        color: '#555',
                        font: { size: 10 }
                    },
                    grid: { 
                        color: 'rgba(0,0,0,0.2)',
                        lineWidth: 0.5
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Symbol Error Rate vs. SNR for MIMO Equalization',
                    font: { size: 14, weight: 'normal' },
                    color: '#333'
                },
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'line',
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function initializeSERChart() {
    const ctx = document.getElementById('serChart').getContext('2d');
    
    // Default limits for empty chart
    const defaultLimits = { min: 0.0001, max: 1 };
    const defaultTickInfo = getDynamicTickLabels(defaultLimits.min, defaultLimits.max);
    
    serChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,
            layout: { padding: 10 },
            scales: {
                y: {
                    type: 'logarithmic',
                    title: { display: true, text: 'Symbol Error Rate (SER)' },
                    min: defaultLimits.min,
                    max: defaultLimits.max,
                    ticks: { 
                        callback: function(v, i, ticks) {
                            const value = Number(v);
                            const index = defaultTickInfo.values.findIndex(val => Math.abs(val - value) < 1e-10);
                            return index !== -1 ? defaultTickInfo.labels[index] : '';
                        },
                        color: '#555',
                        font: { size: 10 },
                        maxTicksLimit: defaultTickInfo.values.length + 1
                    },
                    grid: { 
                        color: function(context) {
                            const value = context.tick.value;
                            if (defaultTickInfo.values.some(val => Math.abs(val - value) < 1e-10)) {
                                return 'rgba(0,0,0,0.3)';
                            }
                            return 'rgba(0,0,0,0.1)';
                        },
                        lineWidth: function(context) {
                            const value = context.tick.value;
                            if (defaultTickInfo.values.some(val => Math.abs(val - value) < 1e-10)) {
                                return 1;
                            }
                            return 0.5;
                        }
                    }
                },
                x: {
                    title: { display: true, text: 'Average SNR (dB)' },
                    min: -5,
                    max: 20,
                    ticks: {
                        stepSize: 5,
                        color: '#555',
                        font: { size: 10 }
                    },
                    grid: { 
                        color: 'rgba(0,0,0,0.2)',
                        lineWidth: 0.5
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Symbol Error Rate vs. SNR for MIMO Equalization',
                    font: { size: 14, weight: 'normal' },
                    color: '#333'
                },
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'line',
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function updateConstellationPlots() {
    try {
        const p = constellations[currentModulation];
        const selectedTechnique = document.querySelector('input[name="technique"]:checked');
        
        if (!selectedTechnique || !p) {
            console.warn('Missing technique selection or constellation points');
            return;
        }
        
        const results = (selectedTechnique.value === 'ZF') ? zfResults : mmseResults;

        if (!results || !Array.isArray(results.equalized)) {
            console.warn('Missing results or equalized data');
            return;
        }
        
        plotConstellation('originalConstellation', modulatedSymbols, p);
        plotConstellation('distortedConstellation', distortedSymbols, p);
        plotConstellation('equalizedConstellation', results.equalized, p, results.demodulatedIndices);
    } catch (error) {
        console.error('Error updating constellation plots:', error);
    }
}

function resetConstellationPlots() {
    Object.values(constellationCharts).forEach(c => c.destroy());
    constellationCharts = {};
    ['originalConstellation', 'distortedConstellation', 'equalizedConstellation'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.getContext('2d').clearRect(0, 0, el.width, el.height);
    });
}

function generateRayleighChannel(Nr, Nt, conditionFactor = 1.0) {
    // Generate complex Rayleigh fading channel
    // For ZF: affects noise enhancement through matrix conditioning
    // For MMSE: affects regularization balance
    const baseChannel = Array.from({ length: Nr }, () => 
        Array.from({ length: Nt }, () => {
            const real = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
            const imag = Math.sqrt(-2 * Math.log(Math.random())) * Math.sin(2 * Math.PI * Math.random());
            return new Complex(real / Math.sqrt(2), imag / Math.sqrt(2));
        })
    );
    
    // Apply condition factor to create more ill-conditioned channels when factor > 1
    if (conditionFactor > 1.0) {
        // Scale some singular values to create condition number issues
        const scaleFactor = 1.0 / conditionFactor;
        baseChannel[0] = baseChannel[0].map(val => val.multiply(scaleFactor));
    }
    
    return baseChannel;
}

function plotConstellation(id, data, ideal, decodedIndices = null) {
    const canvas = document.getElementById(id);
    if (!canvas) {
        console.warn(`Canvas element ${id} not found`);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (constellationCharts[id]) {
        constellationCharts[id].destroy();
        delete constellationCharts[id];
    }

    const dataPts = (data && Array.isArray(data)) ? data.map(p => ({
        x: p.real || 0,
        y: p.imag || 0
    })) : [];
    
    const idealPts = (ideal && Array.isArray(ideal)) ? ideal.map(p => ({
        x: p.real || 0,
        y: p.imag || 0
    })) : [];

    const datasets = [{
        label: 'Ideal',
        data: idealPts,
        backgroundColor: '#000000',
        borderColor: '#000000',
        pointRadius: 8,
        pointStyle: 'crossRot',
        borderWidth: 4
    }];

    if (dataPts.length > 0) {
         datasets.push({
            label: 'Signal',
            data: dataPts,
            backgroundColor: 'rgba(13,110,253,0.7)',
            pointRadius: 6
        });
    }

    if (dataPts.length > 0 && decodedIndices && ideal && originalSymbolIndices) {
        const correctMappings = [];
        const incorrectMappings = [];
        
        for (let i = 0; i < Math.min(dataPts.length, decodedIndices.length, originalSymbolIndices.length); i++) {
            if (typeof dataPts[i].x !== 'undefined' && typeof dataPts[i].y !== 'undefined' &&
                decodedIndices[i] < ideal.length && ideal[decodedIndices[i]]) {
                
                const receivedPoint = dataPts[i];
                const mappedPoint = idealPts[decodedIndices[i]];
                
                const isCorrect = decodedIndices[i] === originalSymbolIndices[i];
                
                if (isCorrect) {
                    correctMappings.push(receivedPoint, mappedPoint, { x: NaN, y: NaN });
                } else {
                    incorrectMappings.push(receivedPoint, mappedPoint, { x: NaN, y: NaN });
                }
            }
        }

        if (correctMappings.length > 0) {
            datasets.push({
                label: 'Correct Mapping',
                data: correctMappings,
                showLine: true,
                borderColor: 'rgba(40, 167, 69, 0.6)',
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        }

        if (incorrectMappings.length > 0) {
            datasets.push({
                label: 'Incorrect Mapping',
                data: incorrectMappings,
                showLine: true,
                borderColor: 'rgba(220, 53, 69, 0.8)',
                borderDash: [3, 3],
                pointRadius: 0,
                fill: false
            });
        }
    }

    const allPoints = [...dataPts, ...idealPts];
    const maxAbsValue = allPoints.reduce((max, pt) => {
        const absReal = Math.abs(pt.x || 0);
        const absImag = Math.abs(pt.y || 0);
        return Math.max(max, absReal, absImag);
    }, 0);
    
    const finalAxisLimit = Math.ceil(Math.max(maxAbsValue, 1)) + 1;
    
    try {
        constellationCharts[id] = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1,
                scales: {
                    x: {
                        title: { display: true, text: 'In-Phase(I)' },
                        min: -finalAxisLimit,
                        max: finalAxisLimit,
                        grid: {
                            color: c => c.tick.value === 0 ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.1)',
                            lineWidth: c => c.tick.value === 0 ? 2 : 1
                        },
                        ticks: { color: '#555' }
                    },
                    y: {
                        title: { display: true, text: 'Quadrature(Q)' },
                        min: -finalAxisLimit,
                        max: finalAxisLimit,
                        grid: {
                            color: c => c.tick.value === 0 ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.1)',
                            lineWidth: c => c.tick.value === 0 ? 2 : 1
                        },
                        ticks: { color: '#555' }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            filter: function(legendItem, chartData) {
                                return legendItem.text.includes('Mapping');
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error(`Error creating chart ${id}:`, error);
    }
}

function calculateDynamicYAxisLimits(datasets) {
    if (!datasets || datasets.length === 0) {
        return { min: 0.0001, max: 1 };
    }
    
    // Find the minimum and maximum values across all datasets
    let globalMin = 1;
    let globalMax = 0;
    
    datasets.forEach(dataset => {
        if (dataset.data && dataset.data.length > 0) {
            const dataMin = Math.min(...dataset.data);
            const dataMax = Math.max(...dataset.data);
            globalMin = Math.min(globalMin, dataMin);
            globalMax = Math.max(globalMax, dataMax);
        }
    });
    
    // Define the logarithmic scale levels
    const logLevels = [1, 0.1, 0.01, 0.001, 0.0001, 0.00001, 0.000001];
    
    // Find appropriate min limit (go one level lower than the minimum data)
    let yMin = 0.000001; // Default minimum
    for (let i = 0; i < logLevels.length - 1; i++) {
        if (globalMin <= logLevels[i] && globalMin > logLevels[i + 1]) {
            yMin = logLevels[i + 1];
            break;
        }
    }
    
    // Find appropriate max limit (go one level higher than the maximum data)
    let yMax = 1; // Default maximum
    for (let i = logLevels.length - 1; i > 0; i--) {
        if (globalMax >= logLevels[i] && globalMax < logLevels[i - 1]) {
            yMax = logLevels[i - 1];
            break;
        }
    }
    
    return { min: yMin, max: yMax };
}

function getDynamicTickLabels(min, max) {
    const logLevels = [1, 0.1, 0.01, 0.001, 0.0001, 0.00001, 0.000001];
    const labels = [];
    const values = [];
    
    // Filter levels that are within our range
    logLevels.forEach(level => {
        if (level >= min && level <= max) {
            values.push(level);
            if (level >= 0.0001) {
                labels.push(level.toString());
            } else if (level === 0.00001) {
                labels.push('1e-005');
            } else if (level === 0.000001) {
                labels.push('1e-006');
            }
        }
    });
    
    return { values, labels };
}