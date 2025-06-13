function openPart(evt, name){
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(name).style.display = "block";
    evt.currentTarget.className += " active";
}

function startup() {
    document.getElementById("default").click();
}

window.onload = startup;

let originalDataMatrix, channelMatrix, noisyReceivedMatrix;
let noiseVariance = 0.05; 
let performanceChart = null;

// --- Helper & Matrix Math Functions (No changes here) ---
function gaussianRandom() { let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random(); return Math.sqrt(-2.0*Math.log(u))*Math.cos(2.0*Math.PI*v); }
function generateGaussianMatrix(r, c, v=1) { let m=[]; for(let i=0;i<r;i++){let row=[]; for(let j=0;j<c;j++){row.push(gaussianRandom()*Math.sqrt(v));} m.push(row);} return m; }
function multiplyMatrices(A,B) { const rA=A.length,cA=A[0].length,rB=B.length,cB=B[0].length; if(cA!==rB)throw new Error('Matrix multiplication dimension mismatch'); const C=Array(rA).fill(0).map(()=>Array(cB).fill(0)); for(let i=0;i<rA;i++){for(let j=0;j<cB;j++){for(let k=0;k<cA;k++){C[i][j]+=A[i][k]*B[k][j];}}} return C; }
function addMatrices(A,B) { return A.map((row,i)=>row.map((val,j)=>val+B[i][j])); }
function transposeMatrix(m) { return m[0].map((_,ci)=>m.map(row=>row[ci])); }
function identityMatrix(s) { const m=Array(s).fill(0).map(()=>Array(s).fill(0)); for(let i=0;i<s;i++)m[i][i]=1; return m; }
function invertMatrix(m) { const s=m.length; const C=m.map((r,i)=>[...r,...identityMatrix(s)[i]]); for(let i=0;i<s;i++){let p=i; while(p<s&&C[p][i]===0)p++; if(p===s)throw new Error("Matrix is not invertible"); [C[i],C[p]]=[C[p],C[i]]; let d=C[i][i]; for(let j=i;j<2*s;j++)C[i][j]/=d; for(let k=0;k<s;k++){if(i!==k){let mult=C[k][i]; for(let j=i;j<2*s;j++)C[k][j]-=mult*C[i][j];}}} return C.map(r=>r.slice(s)); }
function formatMatrixForDisplay(m) { return m.map(r=>'['+r.map(v=>v.toFixed(2)).join(', ')+']').join('<br>'); }

// --- Core Equalization Algorithms (No changes here) ---
function zeroForcing(H) { const H_T=transposeMatrix(H); const H_T_H=multiplyMatrices(H_T,H); const inv_H_T_H=invertMatrix(H_T_H); return multiplyMatrices(inv_H_T_H,H_T); }
function mmse(H, n_v) { const H_T=transposeMatrix(H); const H_T_H=multiplyMatrices(H_T,H); const I=identityMatrix(H_T_H.length); const s_sq_I=I.map(r=>r.map(v=>v*n_v)); const term=addMatrices(H_T_H,s_sq_I); const inv=invertMatrix(term); return multiplyMatrices(inv,H_T); }

// --- Simulation Flow (No changes here) ---
function runSimulation() {
    const input=document.getElementById('inputData').value.trim(); if(!/^[01]{2,8}$/.test(input)){alert('Please enter a binary string with 2 to 8 bits.');return;}
    const noiseVarianceInput=parseFloat(document.getElementById('noiseVarianceInput').value); if(isNaN(noiseVarianceInput)||noiseVarianceInput<0){alert('Please enter a valid, non-negative number for Noise Variance.');return;}
    noiseVariance=noiseVarianceInput; document.getElementById('loadingIndicator').style.display='flex'; document.getElementById('simulateBtn').disabled=true;
    setTimeout(()=>{try{const dataBits=input.split('').map(Number);originalDataMatrix=[dataBits];const N=dataBits.length;channelMatrix=generateGaussianMatrix(N,N);const noiseMatrix=generateGaussianMatrix(1,N,noiseVariance);const transmittedSignal=multiplyMatrices(originalDataMatrix,channelMatrix);noisyReceivedMatrix=addMatrices(transmittedSignal,noiseMatrix);updateSignalFlow_Initial(input,noisyReceivedMatrix);document.getElementById('techniqueSelector').style.display='block';document.getElementById('resultsContainer').style.display='none';const checkedRadio=document.querySelector('input[name="technique"]:checked');if(checkedRadio){checkedRadio.checked=false;}}catch(error){console.error("Simulation Error:",error);alert("A simulation error occurred. The channel matrix might have been non-invertible. Please try again.");}finally{document.getElementById('loadingIndicator').style.display='none';document.getElementById('simulateBtn').disabled=false;}},500);
}

function applyAndCompareEqualizers() {
    const selectedTechniqueRadio=document.querySelector('input[name="technique"]:checked'); if(!selectedTechniqueRadio)return; const selectedTechnique=selectedTechniqueRadio.value; if(!noisyReceivedMatrix)return;
    document.getElementById('loadingIndicator').style.display='flex';
    setTimeout(()=>{try{const equalizerMatrixZF=zeroForcing(channelMatrix);const recoveredSignalZF=multiplyMatrices(noisyReceivedMatrix,equalizerMatrixZF);const recoveredDataZF=makeDecision(recoveredSignalZF[0]);const berZF=calculateBER(originalDataMatrix[0],recoveredDataZF);const equalizerMatrixMMSE=mmse(channelMatrix,noiseVariance);const recoveredSignalMMSE=multiplyMatrices(noisyReceivedMatrix,equalizerMatrixMMSE);const recoveredDataMMSE=makeDecision(recoveredSignalMMSE[0]);const berMMSE=calculateBER(originalDataMatrix[0],recoveredDataMMSE);const input=document.getElementById('inputData').value.trim();updateSignalFlow_Initial(input,noisyReceivedMatrix);if(selectedTechnique==='ZF'){updateSignalFlow_Final('ZF',equalizerMatrixZF,recoveredDataZF);updateResults('ZF',berZF);}else{updateSignalFlow_Final('MMSE',equalizerMatrixMMSE,recoveredDataMMSE);updateResults('MMSE',berMMSE);} updateComparisonTable(originalDataMatrix[0],recoveredDataZF,recoveredDataMMSE);document.getElementById('resultsContainer').style.display='block';}catch(error){console.error("Equalization Error:",error);alert("An error occurred during equalization. The channel matrix might be ill-conditioned. Please simulate again.");}finally{document.getElementById('loadingIndicator').style.display='none';}},500);
}

function makeDecision(signal) { return signal.map(v => v >= 0.5 ? 1 : 0); }
function calculateBER(original, recovered) { let errors=0; for(let i=0;i<original.length;i++){if(original[i]!==recovered[i])errors++;} return original.length > 0 ? errors/original.length:0; }

// --- UI Update Functions ---
function updateSignalFlow_Initial(input, noisyMatrix) {
    const signalFlow=document.getElementById('signalFlow'); const noisyBinary=makeDecision(noisyMatrix[0]).join('');
    signalFlow.innerHTML=`<div class="signal-block"><h4>Original Data (x)</h4><div class="signal-value">${input}</div></div><div class="arrow">→</div><div class="signal-block"><h4>Channel (H)</h4><div class="signal-value">${formatMatrixForDisplay(channelMatrix)}</div></div><div class="arrow">+</div><div class="signal-block"><h4>Noise (n)</h4><div class="signal-value">Variance: ${noiseVariance.toFixed(3)}</div></div><div class="arrow">→</div><div class="signal-block"><h4>Received (y)</h4><div class="signal-value" title="Received analog values: ${formatMatrixForDisplay(noisyMatrix)}">${noisyBinary} (Decision)</div></div>`;
}

function updateSignalFlow_Final(technique, equalizerMatrix, recoveredData){
    document.getElementById('signalFlow').innerHTML+=`<div class="arrow">→</div><div class="signal-block"><h4>${technique} Equalizer (G)</h4><div class="signal-value">${formatMatrixForDisplay(equalizerMatrix)}</div></div><div class="arrow">→</div><div class="signal-block"><h4>Recovered (x̂)</h4><div class="signal-value">${recoveredData.join('')}</div></div>`;
}

function updateResults(technique, ber) {
    document.getElementById('berValue').textContent=(ber*100).toFixed(2)+'%'; document.getElementById('berValue').className='metric-value '+(ber===0?'success-highlight':'error-highlight');
    document.getElementById('techniqueUsed').textContent=technique;
}

function updateComparisonTable(original, recoveredZF, recoveredMMSE) {
    const formatBits = (orig, rec) => {
        let html = '';
        let errors = 0;
        for (let i = 0; i < orig.length; i++) {
            if (orig[i] !== rec[i]) {
                html += `<span class="error-highlight">${rec[i]}</span>`;
                errors++;
            } else {
                html += rec[i];
            }
        }
        const errorClass = errors > 0 ? 'has-errors' : '';
        html += `<span class="bit-error ${errorClass}">${errors} bit error(s)</span>`;
        return html;
    };

    document.getElementById('compareOriginal').innerHTML = original.join('');
    document.getElementById('compareZf').innerHTML = formatBits(original, recoveredZF);
    document.getElementById('compareMmse').innerHTML = formatBits(original, recoveredMMSE);
}

// --- Performance Analysis Tab (No changes here) ---
async function generatePerformanceChart(){document.getElementById('chartLoadingIndicator').style.display='flex';document.getElementById('generateChartBtn').disabled=true;setTimeout(async()=>{const s=[-2,0,2,4,6,8,10,12,14,16];const zB=[],mB=[];for(const snrDb of s){const bz=await runSingleSnrsimulation(snrDb,'ZF');const bm=await runSingleSnrsimulation(snrDb,'MMSE');zB.push(bz);mB.push(bm);} plotPerformanceChart(s,zB,mB);document.getElementById('chartLoadingIndicator').style.display='none';document.getElementById('generateChartBtn').disabled=false;},100);}
function runSingleSnrsimulation(s,t){return new Promise(r=>{const M=2,nB=10000;let tE=0;const sL=10**(s/10);const n_v=1/sL;for(let i=0;i<nB/M;i++){let tx_b=Array.from({length:M},()=>Math.round(Math.random()));let tx_s=[tx_b.map(b=>(2*b-1))];let H=generateGaussianMatrix(M,M);let n=generateGaussianMatrix(M,1,n_v);let y=addMatrices(multiplyMatrices(H,transposeMatrix(tx_s)),n);try{let H_T=transposeMatrix(H);let H_TH=multiplyMatrices(H_T,H);let G;if(t==='ZF'){let iH=invertMatrix(H_TH);G=multiplyMatrices(iH,H_T);}else{let term=addMatrices(H_TH,identityMatrix(M).map(row=>row.map(v=>v*n_v)));let iT=invertMatrix(term);G=multiplyMatrices(iT,H_T);}let xh_T=multiplyMatrices(G,y);let xh=transposeMatrix(xh_T)[0];let rx_b=xh.map(v=>v>0?1:0);for(let j=0;j<M;j++){if(tx_b[j]!==rx_b[j])tE++;}}catch(e){tE+=M;}} r(tE/nB);});}
function plotPerformanceChart(l,zD,mD){const c=document.getElementById('performanceChart').getContext('2d');if(performanceChart)performanceChart.destroy();performanceChart=new Chart(c,{type:'line',data:{labels:l,datasets:[{label:'Zero Forcing (ZF)',data:zD,borderColor:'#0d6efd',backgroundColor:'rgba(13,110,253,0.1)',tension:0.1},{label:'MMSE',data:mD,borderColor:'#dc3545',backgroundColor:'rgba(220,53,69,0.1)',tension:0.1}]},options:{responsive:true,plugins:{title:{display:true,text:'BER vs. SNR Performance (2x2 MIMO)',font:{size:16}},legend:{position:'top'}},scales:{x:{title:{display:true,text:'SNR (dB)'}},y:{type:'logarithmic',title:{display:true,text:'Bit Error Rate (BER)'}}}}});}

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loadingIndicator').style.display = 'none';
    document.querySelectorAll('input[name="technique"]').forEach(radio => {
        radio.addEventListener('change', applyAndCompareEqualizers);
    });
});

// Input validation
document.getElementById('inputData').addEventListener('input',function(){const v=this.value;if(v&&!/^[01]*$/.test(v)){this.classList.add('is-invalid');}else{this.classList.remove('is-invalid');}});