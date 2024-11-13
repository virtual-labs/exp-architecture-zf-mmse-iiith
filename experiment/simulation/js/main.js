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

  function parseMatrix(input) {
    return input.trim().split('').map(row => row.split(',').map(Number));
}

function generateGaussianMatrix(rows, cols) {
    let matrix = [];
    for (let i = 0; i < rows; i++) {
        let row = [];
        for (let j = 0; j < cols; j++) {
            row.push(gaussianRandom());
        }
        matrix.push(row);
    }
    return matrix;
}



function getVar(){
  return  Math.random() * 9+ 1; 
}

function oneDMatrixToString(matrix) {
  return matrix.map(String).join('');
}



function gaussianRandom(){
  const variance = getVar();
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  let standardNormal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return standardNormal * Math.sqrt(variance);
}

function multiplyMatrices(matrixA, matrixB) {
  const rowsA = matrixA.length;
  const colsA = matrixA[0].length;
  const rowsB = matrixB.length;
  const colsB = matrixB[0].length;

  // if (colsA !== rowsB) {
  //   throw new Error('The number of columns in the first matrix must be equal to the number of rows in the second matrix.');
  // }
  const result = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += matrixA[i][k] * matrixB[k][j];
      }
    }
  }

  return result;
}

let storedInput = "";
let gaussianMatrix, noisyResultMatrix;

function getOut(input) {
  const matrix = parseMatrix(input);
  const cols = matrix.length;
  gaussianMatrix = generateGaussianMatrix(cols, cols);
  const resultMatrix = multiplyMatrices([matrix], gaussianMatrix);
  const noiseMatrix = generateGaussianMatrix(resultMatrix.length, resultMatrix[0].length);
  noisyResultMatrix = addMatrices(resultMatrix, noiseMatrix);
  const roundedMatrix = noisyResultMatrix.map(row =>
      row.map(value => Number(value.toFixed(2)))
  );
  console.log(roundedMatrix);
  return { roundedMatrix, gaussianMatrix, noisyResultMatrix };
}

function getOut2(techniqueSelect) {
  console.log("Executing technique selection...");

  // Log dimensions of noisyResultMatrix and gaussianMatrix
  console.log("Dimensions of noisyResultMatrix:", noisyResultMatrix.length, noisyResultMatrix[0].length);
  console.log("Dimensions of gaussianMatrix:", gaussianMatrix.length, gaussianMatrix[0].length);

  let outputMatrix;
  let get;

  if (techniqueSelect === 'ZF') {
      get = zeroForcing(noisyResultMatrix, gaussianMatrix);
      // Log dimensions of get
      console.log("Dimensions of get (ZF):", get.length, get[0].length);
      outputMatrix = multiplyMatrices(noisyResultMatrix, get);
  } else if (techniqueSelect === 'MMSE') {
      get = mmse(noisyResultMatrix, gaussianMatrix);
      // Log dimensions of get
      console.log("Dimensions of get (MMSE):", get.length, get[0].length);
      outputMatrix = multiplyMatrices(noisyResultMatrix, get);
  }

  console.log("Output matrix before decision-making:");
  console.log(outputMatrix);

  const decision = makeDecision(outputMatrix);
  const x=oneDMatrixToString(decision);
  console.log(x);
  return x;

}
function getOut_2(techniqueSelect, noisyResultMatrix, gaussianMatrix) {
  console.log("Executing technique selection...");

  // Log dimensions of noisyResultMatrix and gaussianMatrix
  console.log("Dimensions of noisyResultMatrix:", noisyResultMatrix.length, noisyResultMatrix[0].length);
  console.log("Dimensions of gaussianMatrix:", gaussianMatrix.length, gaussianMatrix[0].length);

  let outputMatrix;
  let get;

  if (techniqueSelect === 'ZF') {
      get = zeroForcing(noisyResultMatrix, gaussianMatrix);
      console.log("Dimensions of get (ZF):", get.length, get[0].length);
      outputMatrix = multiplyMatrices(noisyResultMatrix, get);
  } else if (techniqueSelect === 'MMSE') {
      get = mmse(noisyResultMatrix, gaussianMatrix);
      // Log dimensions of get
      console.log("Dimensions of get (MMSE):", get.length, get[0].length);
      outputMatrix = multiplyMatrices(noisyResultMatrix, get);
  }

  console.log("Output matrix before decision-making:");
  console.log(outputMatrix);

  const decision = makeDecision(outputMatrix);
  const x=oneDMatrixToString(decision);
  console.log(x);
  return x;

}


function getOutput1() {
  storedInput = document.getElementById('input').value;
  const x=storedInput;
  const { roundedMatrix } = getOut(storedInput);

  document.getElementById('observations1').innerText = `input: ${x}\n`;
  document.getElementById('observations1').innerText += `\nChannel Output:${JSON.stringify(roundedMatrix)}`;
  
  // document.getElementById('inputSection').style.display = 'none';
  document.getElementById('techniqueSection').style.display = 'block';
}

function getOutput2() {
  const techniqueSelect = document.querySelector('input[name="technique"]:checked').value;
  const decision = getOut2(techniqueSelect);
  document.getElementById('observations1').innerText += `\n${techniqueSelect}: ${decision}\n`;
}

// // Event listeners
// document.getElementById('calculateButton').addEventListener('click', getOutput1);
// document.getElementById('techniqueButton').addEventListener('click', getOutput2);




function zeroForcing(noisyMatrix, gaussianMatrix) {
  console.log("entered in ff");
  const gaussianTranspose = transposeMatrix(gaussianMatrix);
  const HhH = multiplyMatrices(gaussianTranspose, gaussianMatrix);
  const invers_HhH=invertMatrix(HhH);
  const outputMatrix = multiplyMatrices(invers_HhH,gaussianTranspose);
  return outputMatrix    
}

function mmse(noisyMatrix, gaussianMatrix) {
  console.log("entered in mmse");
 const gaussianTranspose = transposeMatrix(gaussianMatrix);
 const HhH = multiplyMatrices(gaussianTranspose, gaussianMatrix);

 const variance = getVar();


 // 3. Create an identity matrix of the appropriate size

 const identity = identityMatrix(gaussianMatrix.length); // Assuming square matrices


 // 4.  Calculate variance * variance * identity matrix

 const scaledIdentity = identity.map(row => row.map(val => val * variance * variance));

 // 5.  Add the results from step 1 and step 4
 const weightMatrix = addMatrices(HhH, scaledIdentity); 
  const lastinvers=invertMatrix(weightMatrix);

  const outputMatrix = multiplyMatrices(lastinvers, transposeMatrix(gaussianMatrix));

  return outputMatrix;

}
function transposeMatrix(matrix) {

  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));

}
function identityMatrix(size) {

  const matrix = [];

  for (let i = 0; i < size; i++) {

    matrix[i] = new Array(size).fill(0);

    matrix[i][i] = 1; 

  }

  return matrix;

}
function calculateVariance(matrix){
  const mean = calculateMean(matrix);
  const squaredDifferences = matrix.map(row => row.map(value => Math.pow(value - mean, 2)));
  const sumOfSquaredDifferences = squaredDifferences.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  return sumOfSquaredDifferences / (matrix.length - 1);
}

function calculateMean(matrix){
  const sum = matrix.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  return sum / (matrix.length * matrix[0].length);
}

function invertMatrix(matrix)
{
  const rows = matrix.length;
  const cols = matrix[0].length;
  const inverseMatrix = [];
  for (let i = 0; i < rows; i++) {
    inverseMatrix[i] = [];
    for (let j = 0; j < cols; j++) {
      inverseMatrix[i][j] = (i === j) ? 1 : 0;
    }
   }

   for (let i = 0; i < rows; i++){
    let pivot = matrix[i][i];
    if (pivot === 0) {
      throw new Error("Matrix is not invertible");
    }
    for (let j = 0; j < cols; j++) {
      matrix[i][j] /= pivot;
      inverseMatrix[i][j] /= pivot;
    }
    for (let k = 0; k < rows; k++) {
      if (k !== i) {
        let factor = matrix[k][i];
        for (let j = 0; j < cols; j++) {
          matrix[k][j] -= factor * matrix[i][j];
          inverseMatrix[k][j] -= factor * inverseMatrix[i][j];
        }
      }
    }
   }
  return inverseMatrix;
}


function makeDecision(finalOutput) {

  const decisionMatrix = [];

  for (let i = 0; i < finalOutput.length; i++) {

    decisionMatrix[i] = [];

    for (let j = 0; j < finalOutput[0].length; j++) {

      if (finalOutput[i][j] >= 0.5) {

        decisionMatrix[i][j] = 1;

      } else {

        decisionMatrix[i][j] = 0;

      }

    }

  }
  return decisionMatrix;
}

function addMatrices(matrixA, matrixB) {
  return matrixA.map((rowA, i) => {
    return rowA.map((valueA, j) => {
      return valueA + matrixB[i][j];
    });
  });
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Function to calculate Signal-to-Noise Ratio (SNR) for 1D arrays
function calculateSNR(original, noisy) {
  let signalPower = 0;
  let noisePower = 0;

  // Ensure that original and noisy are arrays and of the same length
  if (!original || !noisy || original.length !== noisy.length) {
    console.error('Invalid input arrays:', original, noisy);
    return 0;  // Return a default value
  }

  // Loop through the arrays assuming they are 1D
  for (let i = 0; i < original.length; i++) {
      if (original[i] !== undefined && noisy[i] !== undefined) {
          signalPower += Math.pow(original[i], 2);  // Signal power
          noisePower += Math.pow(original[i] - noisy[i], 2);  // Noise power
      } else {
          console.error(`original[${i}] or noisy[${i}] is undefined`);
      }
  }

  const snr = signalPower / noisePower;
  return snr;
}

// Function to calculate Bit Error Rate (BER) for 1D arrays
let errors = 0;
function calculateBER(original, decision) {
 
  // Flatten the arrays if they are neste
  if (Array.isArray(original) && Array.isArray(original[0])) {
    original = original[0];
  }
  if (Array.isArray(decision) && Array.isArray(decision[0])) {
    decision = decision[0];
  }

  // Ensure that original and decision are arrays of the same length
  if (!original || !decision || original.length !== decision.length) {
    console.error('Invalid input arrays:', original, decision);
    return 0;  // Return a default value
  }

  // Loop through the arrays and count errors
  for (let i = 0; i < original.length; i++) {
    if (original[i] !== undefined && decision[i] !== undefined) {
      if (original[i] !== decision[i]) {
        errors++;  // Count errors
      }
    } else {
      console.error(`original[${i}] or decision[${i}] is undefined`);
    }
  }

  const totalBits = original.length*1000;
  return errors / totalBits;  // BER is the ratio of errors to total bits
}


// Function to generate a random binary string of specified length
function generateRandomBinaryString(length) {
  const characters = '01';  // Binary characters (0 and 1)
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Function to round each element in the matrix (here it will simply round binary values, which are 0 or 1)
function getRoundedMatrix(input) {
  return input.map(value => Math.round(value)); // Will round values but in case of binary, it does nothing
}
function parseBinaryString(input) {
  return input.split(',').map(str => parseInt(str.trim(), 10));
}



// Function to process input and generate output
function getOutput3() {
  const numberOfInputs = 2;  // Example number of inputs
  const Mt = document.getElementById('input2').value;  // Example: Matrix size (row count)
  const Mr = document.getElementById('input3').value;  // Example: Matrix size (column count)

  const randomBinaryString = generateRandomBinaryString(Mt);  // Generate random binary string
  console.log("Generated Random Binary String:", randomBinaryString);

  // Parsing the binary input into an array of bits (matrix)
  const parsedInput = parseBinaryString(randomBinaryString);  // Convert input string to an array of bits
  console.log('Parsed Input:', parsedInput);  // Example

  // Example for generating random Gaussian matrix
  const snrZF = [];
  const snrMMSE = [];
  const berZF = [];
  const berMMSE = [];

  // Loop through each input for matrix operations
  for (let i = 0; i < numberOfInputs; i++) {
    const input = parsedInput[i];  // Get the current input bit

    // Assuming input is a 1D array (row vector for matrix operations)
    const inputMatrix = [input];  // Representing the bit as a row matrix (example)

    const gaussianMatrix = generateGaussianMatrix(Mr, Mt);  // Generate a random Gaussian matrix
    const resultMatrix = multiplyMatrices(gaussianMatrix, inputMatrix);  // Matrix multiplication

    const noiseMatrix = generateGaussianMatrix(resultMatrix.length, resultMatrix[0].length);  // Generate noise matrix
    const noisyResultMatrix = addMatrices(resultMatrix, noiseMatrix);  // Add noise to the result matrix

    const roundedMatrix = getRoundedMatrix(inputMatrix);  // Round matrix values (if needed)

    const zfOutput = getOut_2('ZF', noisyResultMatrix, gaussianMatrix);  // ZF processing
    const mmseOutput = getOut_2('MMSE', noisyResultMatrix, gaussianMatrix);  // MMSE processing

    // Calculate SNR for ZF and MMSE
    const snrZFValue = calculateSNR(roundedMatrix, zfOutput);  // Calculate SNR
    const snrMMSEValue = calculateSNR(roundedMatrix, mmseOutput);  // Calculate SNR

    snrZF.push(snrZFValue);  // Store ZF SNR
    snrMMSE.push(snrMMSEValue);  // Store MMSE SNR

    // Calculate BER for ZF and MMSE
    const berZFValue = calculateBER(roundedMatrix, zfOutput);  // Calculate BER for ZF
    const berMMSEValue = calculateBER(roundedMatrix, mmseOutput);  // Calculate BER for MMSE

    berZF.push(berZFValue);  // Store ZF BER
    berMMSE.push(berMMSEValue);  // Store MMSE BER
  }

  // Log final arrays (optional)
  console.log('SNR ZF:', snrZF);
  console.log('SNR MMSE:', snrMMSE);
  console.log('BER ZF:', berZF);
  console.log('BER MMSE:', berMMSE);




  document.getElementById("observations2").innerHTML = `
  <canvas id="snrBerChart"></canvas>
`;
const canvas = document.getElementById('snrBerChart');
canvas.width =900;
canvas.height =700;
const ctx = canvas.getContext('2d');

// Ensure snrZF, berZF, snrMMSE, and berMMSE contain data

const snrBerChart = new Chart(ctx, {
  type: 'line',
  data: {
      labels: snrZF, // SNR values as the X-axis
      datasets: [{
          label: 'BER (ZF)',
          data: berZF,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: false,
          tension: 0.1
      }, {
          label: 'BER (MMSE)',
          data: berMMSE,
          borderColor: 'rgba(153, 102, 255, 1)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          fill: false,
          tension: 0.1
      }]
  },
  options: {
      responsive: true,
      scales: {
          x: {
              title: {
                  display: true,
                  text: 'SNR (Signal to Noise Ratio)',
                  font: {
                      size: 16
                  }
              },
              ticks: {
                  beginAtZero: true,
                  maxRotation: 90, // Avoid overlapping labels
                  minRotation: 45,
              },
              grid: {
                  display: true,
                  drawBorder: true
              }
          },
          y: {
              title: {
                  display: true,
                  text: 'BER (Bit Error Rate)',
                  font: {
                      size: 16
                  }
              },
              ticks: {
                  beginAtZero: true,
                  stepSize: 0.1
              },
              grid: {
                  display: true,
                  drawBorder: true
              }
          }
      },
      plugins: {
          legend: {
              position: 'top'
          },
          tooltip: {
              enabled: true
          }
      }
  }
});

}
