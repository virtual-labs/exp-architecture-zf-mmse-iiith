
// --- GLOBAL STATE ---
let originalSymbolIndices = [], modulatedSymbols = [], currentModulation = 'QPSK';
let zfResults = null, mmseResults = null, serChart = null, constellationCharts = {};
let distortedSymbols = [], currentNt = 2, currentNr = 2;

// --- COMPLEX NUMBER CLASS ---
class Complex {constructor(r,i=0){this.real=r;this.imag=i}add(o){return new Complex(this.real+o.real,this.imag+o.imag)}subtract(o){return new Complex(this.real-o.real,this.imag-o.imag)}multiply(o){if(typeof o==='number')return new Complex(this.real*o,this.imag*o);return new Complex(this.real*o.real-this.imag*o.imag,this.real*o.imag+this.imag*o.real)}divide(o){const d=o.real*o.real+o.imag*o.imag;if(d===0)return new Complex(Infinity,Infinity);return new Complex((this.real*o.real+this.imag*o.imag)/d,(this.imag*o.real-this.real*o.imag)/d)}conjugate(){return new Complex(this.real,-this.imag)}magnitudeSq(){return this.real*this.real+this.imag*this.imag}toString(p=2){return`${this.real.toFixed(p)}${this.imag>=0?'+':''}${this.imag.toFixed(p)}j`}}

// --- MODULATION CONSTANTS ---
const constellations={BPSK:[new Complex(-1,0),new Complex(1,0)],QPSK:[new Complex(1,1),new Complex(-1,1),new Complex(-1,-1),new Complex(1,-1)].map(c=>c.multiply(1/Math.sqrt(2))),'16QAM':(()=>{const p=[];for(let i of[-3,-1,1,3])for(let q of[-3,-1,1,3])p.push(new Complex(i,q));return p.map(c=>c.multiply(1/Math.sqrt(10)))})(),'64QAM':(()=>{const p=[];for(let i of[-7,-5,-3,-1,1,3,5,7])for(let q of[-7,-5,-3,-1,1,3,5,7])p.push(new Complex(i,q));return p.map(c=>c.multiply(1/Math.sqrt(42)))})()};

// --- UI & CONTROL FUNCTIONS ---
document.addEventListener('DOMContentLoaded',() => {
    calculateSERvsSNR();
    resetSignalFlow();
});

function generateRandomSymbols(){
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
    await new Promise(r => setTimeout(r, 50));

    generateRandomSymbols();
    const Nt = currentNt;
    const Nr = currentNr;

    const snr_dB = parseFloat(document.getElementById('snrInput').value);
    const constPoints = constellations[currentModulation];
    const E_avg = constPoints.reduce((s, v) => s + v.magnitudeSq(), 0) / constPoints.length;
    const noiseVariance = E_avg / (10 ** (snr_dB / 10));

    // Generate Nr x Nt channel matrix
    const H = generateComplexChannel(Nr, Nt);
    const receivedSymbols = multiplyMatrixVector(H, modulatedSymbols);
    const noise = Array.from({length: Nr}, () => generateComplexGaussian().multiply(Math.sqrt(noiseVariance)));
    const noisyReceivedSymbols = receivedSymbols.map((s, i) => s.add(noise[i]));

    // Store distorted symbols (before adding noise) for visualization
    distortedSymbols = receivedSymbols.slice();

    // Calculate condition number for channel quality assessment
    const condNum = calculateConditionNumber(H);

    let zf_eq, mmse_eq;
    let zf_demod, mmse_demod;

    // Replace the MMSE equalizer sections in runSimulation() function

    // In runSimulation() - replace the MMSE calculation parts:

    if (Nr >= Nt) {
        // Overdetermined or square system - use pseudoinverse
        const H_H = transposeConjugateMatrix(H);
        const H_H_H = multiplyComplexMatrices(H_H, H);
        const H_inv = invertMatrix(H_H_H);
        const W_zf = H_inv ? multiplyComplexMatrices(H_inv, H_H) : null;

        // MMSE equalizer - Fixed noise variance scaling
        const I = identityMatrix(Nt);
        const noiseTerm = multiplyMatrixScalar(I, noiseVariance / E_avg); // Normalize by signal power
        const mmse_inv = invertMatrix(addMatrices(H_H_H, noiseTerm));
        const W_mmse = mmse_inv ? multiplyComplexMatrices(mmse_inv, H_H) : null;

        zf_eq = W_zf ? multiplyMatrixVector(W_zf, noisyReceivedSymbols) : Array(Nt).fill(new Complex(0,0));
        mmse_eq = W_mmse ? multiplyMatrixVector(W_mmse, noisyReceivedSymbols) : Array(Nt).fill(new Complex(0,0));
    } else {
        // Underdetermined system - use left pseudoinverse
        const H_H = transposeConjugateMatrix(H);
        const H_H_H = multiplyComplexMatrices(H, H_H);
        const H_inv = invertMatrix(H_H_H);
        const W_zf = H_inv ? multiplyComplexMatrices(H_H, H_inv) : null;

        // MMSE for underdetermined - Fixed implementation
        const I = identityMatrix(Nr);
        const noiseTerm = multiplyMatrixScalar(I, noiseVariance / E_avg); // Normalize by signal power
        const mmse_inv = invertMatrix(addMatrices(H_H_H, noiseTerm));
        const W_mmse = mmse_inv ? multiplyComplexMatrices(H_H, mmse_inv) : null;

        zf_eq = W_zf ? multiplyMatrixVector(W_zf, noisyReceivedSymbols) : Array(Nt).fill(new Complex(0,0));
        mmse_eq = W_mmse ? multiplyMatrixVector(W_mmse, noisyReceivedSymbols) : Array(Nt).fill(new Complex(0,0));
    }

    zf_demod = demodulate(zf_eq, currentModulation);
    mmse_demod = demodulate(mmse_eq, currentModulation);

    zfResults = { equalized: zf_eq, ser: calculateSER(originalSymbolIndices, zf_demod.indices), errors: zf_demod.indices.filter((s, i) => s !== originalSymbolIndices[i]).length, conditionNumber: condNum };
    mmseResults = { equalized: mmse_eq, ser: calculateSER(originalSymbolIndices, mmse_demod.indices), errors: mmse_demod.indices.filter((s, i) => s !== originalSymbolIndices[i]).length, conditionNumber: condNum };

    document.getElementById('techniqueSelector').style.display = 'block';
    document.getElementById('resultsContainer').style.display = 'block';
    document.getElementById('constellationSection').style.display = 'block';
    document.getElementById('simulateBtn').style.display = 'none';
    document.getElementById('regenerateBtn').style.display = 'block';

    updateSignalFlow(H, noisyReceivedSymbols);
    updateDisplay();
    updateConstellationPlots();

    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('simulateBtn').disabled = false;
    document.getElementById('regenerateBtn').disabled = false;
}

function updateDisplay() {
    const t = document.querySelector('input[name="technique"]:checked').value;
    const r = (t === 'ZF') ? zfResults : mmseResults;
    if (!r) return;

    document.getElementById('serValue').innerText = r.ser.toFixed(3);
    document.getElementById('errorCount').innerText = `${r.errors} / ${originalSymbolIndices.length}`;
    document.getElementById('conditionNumber').innerText = r.conditionNumber.toFixed(2);

    // Update equalized plot title
    const equalizedPlot = document.getElementById('equalizedPlot');
    if (equalizedPlot) {
        equalizedPlot.querySelector('h5').innerText = `Equalized (${t})`;
    }

    const eqBlock = document.getElementById('flow-equalized');
    if (eqBlock) {
        eqBlock.innerHTML = `<h4>${t} Equalized (x̂)</h4><div class="signal-value">${r.equalized.map(s => s.toString(2)).join('<br>')}</div>`;
    }

    // Update constellation plot
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
            <div class="noise-adder-label">AWGN</div>
        </div>
        <div class="arrow">→</div>
        <div class="signal-block"><h4>Received (y)</h4><div class="signal-value">${noisyReceivedSymbols.map(s => s.toString(2)).join('<br>')}<br><small>${Nr} antennas</small></div></div>
        <div class="arrow">→</div>
        <div class="signal-block" id="flow-equalized"></div>
    `;
    updateDisplay();
}

function resetSignalFlow(){document.getElementById('signalFlow').innerHTML='<div class="signal-block" style="width:100%"><h4>MIMO Simulation Flow</h4><div class="signal-value" style="text-align:center; padding-top:20px;">Configure MIMO parameters and click "Simulate Channel" to begin.</div></div>'}

// --- CORE LOGIC & MATH ---
function generateComplexGaussian(){const u1=Math.random(),u2=Math.random();return new Complex(Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2)/Math.sqrt(2),Math.sqrt(-2*Math.log(u1))*Math.sin(2*Math.PI*u2)/Math.sqrt(2))}

function generateComplexChannel(Nr, Nt){
    return Array.from({length:Nr},()=>Array.from({length:Nt},()=>generateComplexGaussian()))
}

function demodulate(r,m){const c=constellations[m];if(!r||r.length===0||!c)return{indices:[],symbols:[]};const i=r.map(s=>{let best=0,min=Infinity;for(let j=0;j<c.length;j++){const d=s.subtract(c[j]).magnitudeSq();if(d<min){min=d;best=j;}}return best;});return{indices:i,symbols:i.map(j=>c[j])}}

function calculateSER(o,r){if(o.length!==r.length||o.length===0)return 0;return o.reduce((a,v,i)=>a+(v!==r[i]?1:0),0)/o.length}

function calculateConditionNumber(H) {
    // Simplified condition number estimation using Frobenius norms
    const H_H = transposeConjugateMatrix(H);
    const HHH = multiplyComplexMatrices(H_H, H);

    // Calculate trace (sum of diagonal elements) as approximation
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
function multiplyMatrixVector(m,v){return m.map(r=>r.reduce((a,c,j)=>a.add(c.multiply(v[j])),new Complex(0,0)))}
function multiplyComplexMatrices(A,B){const C=Array(A.length).fill(0).map(()=>Array(B[0].length).fill(new Complex(0,0)));for(let i=0;i<A.length;i++)for(let j=0;j<B[0].length;j++)for(let k=0;k<A[0].length;k++)C[i][j]=C[i][j].add(A[i][k].multiply(B[k][j]));return C}
function transposeConjugateMatrix(m){const r=Array(m[0].length).fill(0).map(()=>Array(m.length));for(let i=0;i<m.length;i++)for(let j=0;j<m[0].length;j++)r[j][i]=m[i][j].conjugate();return r}
function addMatrices(A,B){return A.map((r,i)=>r.map((v,j)=>v.add(B[i][j])))}
function multiplyMatrixScalar(m,s){return m.map(r=>r.map(v=>v.multiply(s)))}
function identityMatrix(s){const I=Array(s).fill(0).map(()=>Array(s).fill(new Complex(0,0)));for(let i=0;i<s;i++)I[i][i]=new Complex(1,0);return I}
function invertMatrix(m){const n=m.length;if(n===0) return [];const A=m.map((r,i)=>[...r.map(c=>new Complex(c.real,c.imag)),...identityMatrix(n)[i]]);for(let i=0;i<n;i++){let p=i;while(p<n&&A[p][i].magnitudeSq()<1e-12)p++;if(p===n)return null;[A[i],A[p]]=[A[p],A[i]];let d=A[i][i];for(let j=i;j<2*n;j++)A[i][j]=A[i][j].divide(d);for(let k=0;k<n;k++)if(i!==k){let M=A[k][i];for(let j=i;j<2*n;j++)A[k][j]=A[k][j].subtract(M.multiply(A[i][j]));}}return A.map(r=>r.slice(n))}

// --- CHARTING FUNCTIONS ---
async function calculateSERvsSNR() {
    document.getElementById('chartLoadingIndicator').style.display = 'flex';
    await new Promise(r => setTimeout(r, 50));
    const T = 100; // Reduced trials for faster computation
    const Nt = parseInt(document.getElementById('numTxAntennas').value);
    const Nr = parseInt(document.getElementById('numRxAntennas').value);
    const snr_dB = Array.from({length: 11}, (_, i) => i * 2);
    const mod = document.getElementById('modulationScheme').value;
    const c = constellations[mod];
    const E_avg = c.reduce((s, v) => s + v.magnitudeSq(), 0) / c.length;

    let zf_d = [], mmse_d = [];
    for (const db of snr_dB) {
        const N0 = E_avg / (10 ** (db / 10));
        let zf_e = 0, mmse_e = 0, total_s = 0;
        for (let t = 0; t < T; t++) {
            const H = generateComplexChannel(Nr, Nt);
            const o = Array.from({ length: Nt }, () => Math.floor(Math.random() * c.length));
            const m = o.map(i => c[i]);
            const r = multiplyMatrixVector(H, m);
            const noise = Array.from({ length: Nr }, () => generateComplexGaussian().multiply(Math.sqrt(N0)));
            const y = r.map((s, i) => s.add(noise[i]));

            // ZF equalizer
            let zf_eq;
            if (Nr >= Nt) {
                const H_H = transposeConjugateMatrix(H);
                const H_H_H = multiplyComplexMatrices(H_H, H);
                const H_inv = invertMatrix(H_H_H);
                const W_zf = H_inv ? multiplyComplexMatrices(H_inv, H_H) : null;
                zf_eq = W_zf ? multiplyMatrixVector(W_zf, y) : Array(Nt).fill(new Complex(0,0));
            } else {
                const H_H = transposeConjugateMatrix(H);
                const H_H_H = multiplyComplexMatrices(H, H_H);
                const H_inv = invertMatrix(H_H_H);
                const W_zf = H_inv ? multiplyComplexMatrices(H_H, H_inv) : null;
                zf_eq = W_zf ? multiplyMatrixVector(W_zf, y) : Array(Nt).fill(new Complex(0,0));
            }

            // MMSE equalizer
            // Replace the MMSE equalizer section in calculateSERvsSNR() function

            // In calculateSERvsSNR() - replace the MMSE equalizer calculation:

            // MMSE equalizer - Fixed implementation
            let mmse_eq;
            if (Nr >= Nt) {
                const H_H = transposeConjugateMatrix(H);
                const H_H_H = multiplyComplexMatrices(H_H, H);
                const I = identityMatrix(Nt);
                const noiseTerm = multiplyMatrixScalar(I, N0 / E_avg); // Normalize by signal power
                const mmse_inv = invertMatrix(addMatrices(H_H_H, noiseTerm));
                const W_mmse = mmse_inv ? multiplyComplexMatrices(mmse_inv, H_H) : null;
                mmse_eq = W_mmse ? multiplyMatrixVector(W_mmse, y) : Array(Nt).fill(new Complex(0,0));
            } else {
                const H_H = transposeConjugateMatrix(H);
                const H_H_H = multiplyComplexMatrices(H, H_H);
                const I = identityMatrix(Nr);
                const noiseTerm = multiplyMatrixScalar(I, N0 / E_avg); // Normalize by signal power
                const mmse_inv = invertMatrix(addMatrices(H_H_H, noiseTerm));
                const W_mmse = mmse_inv ? multiplyComplexMatrices(H_H, mmse_inv) : null;
                mmse_eq = W_mmse ? multiplyMatrixVector(W_mmse, y) : Array(Nt).fill(new Complex(0,0));
            }

            zf_e += calculateSER(o, demodulate(zf_eq, mod).indices) * Nt;
            mmse_e += calculateSER(o, demodulate(mmse_eq, mod).indices) * Nt;
            total_s += Nt;
        }
        zf_d.push(total_s > 0 ? zf_e / total_s : 1);
        mmse_d.push(total_s > 0 ? mmse_e / total_s : 1);
    }
    plotSERChart(snr_dB, zf_d, mmse_d, mod, Nt, Nr);
    document.getElementById('chartLoadingIndicator').style.display = 'none';
}

// Replace the plotSERChart function with this fixed version

function plotSERChart(labels, zfData, mmseData, mod, Nt, Nr) {
    if (serChart) serChart.destroy();
    const ctx = document.getElementById('serChart').getContext('2d');
    serChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'ZF SER',
                data: zfData,
                borderColor: '#e74c3c',
                backgroundColor: '#e74c3c',
                fill: false,
                tension: 0.1
            }, {
                label: 'MMSE SER',
                data: mmseData,
                borderColor: '#3498db',
                backgroundColor: '#3498db',
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // This allows the chart to fill the container
            aspectRatio: 2, // Width to height ratio
            layout: {
                padding: 10
            },
            scales: {
                y: {
                    type: 'logarithmic',
                    title: {
                        display: true,
                        text: 'Symbol Error Rate (SER)'
                    },
                    min: 1e-4,
                    max: 1,
                    ticks: {
                        callback: function(v) {
                            return v.toExponential(1);
                        },
                        color: '#555'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'SNR (dB)'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        color: '#555'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `SER Performance for ${mod} (${Nt}×${Nr} MIMO)`,
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}
function updateConstellationPlots() {
    const p = constellations[currentModulation];
    const selectedTechnique = document.querySelector('input[name="technique"]:checked').value;
    const results = (selectedTechnique === 'ZF') ? zfResults : mmseResults;

    if (!p || !results) return;

    const axisLimit = Math.max(
        ...results.equalized.flatMap(pt=>[Math.abs(pt.real),Math.abs(pt.imag)]),
        ...distortedSymbols.flatMap(pt=>[Math.abs(pt.real),Math.abs(pt.imag)]),
        ...p.flatMap(pt=>[Math.abs(pt.real),Math.abs(pt.imag)]),
        0.5
    ) * 1.2;

    plotConstellation('originalConstellation', modulatedSymbols, p);
    plotConstellation('distortedConstellation', distortedSymbols, p, axisLimit);
    plotConstellation('equalizedConstellation', results.equalized, p, axisLimit);
}

function resetConstellationPlots(){Object.values(constellationCharts).forEach(c=>c.destroy());constellationCharts={};['originalConstellation','distortedConstellation','equalizedConstellation'].forEach(id=>{const el=document.getElementById(id);if(el)el.getContext('2d').clearRect(0,0,el.width,el.height)})}

function plotConstellation(id, data, ideal, axisLimit = null) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (constellationCharts[id]) constellationCharts[id].destroy();
    const dataPts = data ? data.map(p => ({ x: p.real, y: p.imag })) : [];
    const idealPts = ideal ? ideal.map(p => ({ x: p.real, y: p.imag })) : [];
    const maxVal = axisLimit ? axisLimit : Math.max(...dataPts.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]),...idealPts.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]),0.5) * 1.2;
    constellationCharts[id] = new Chart(ctx, {type:'scatter',data:{datasets:[{label:'Ideal',data:idealPts,backgroundColor:'rgba(231,76,60,0.9)',pointRadius:7,pointStyle:'crossRot',borderWidth:2},{label:'Signal',data:dataPts,backgroundColor:'rgba(13,110,253,0.7)',pointRadius:6}]},options:{responsive:true,maintainAspectRatio:true,aspectRatio:1,scales:{x:{title:{display:true,text:'In-Phase(I)'},min:-maxVal,max:maxVal,grid:{color:c=>c.tick.value===0?'rgba(0,0,0,0.6)':'rgba(0,0,0,0.1)',lineWidth:c=>c.tick.value===0?2:1},ticks:{color:'#555'}},y:{title:{display:true,text:'Quadrature(Q)'},min:-maxVal,max:maxVal,grid:{color:c=>c.tick.value===0?'rgba(0,0,0,0.6)':'rgba(0,0,0,0.1)',lineWidth:c=>c.tick.value===0?2:1},ticks:{color:'#555'}}},plugins:{legend:{display:false}}}});
}

// Update performance chart when MIMO configuration changes
document.getElementById('numTxAntennas').addEventListener('change', calculateSERvsSNR);
document.getElementById('numRxAntennas').addEventListener('change', calculateSERvsSNR);
document.getElementById('modulationScheme').addEventListener('change', calculateSERvsSNR);
