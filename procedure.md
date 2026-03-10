In this experiment, you will compare the equalization schemes incorporated in communication receiver architectures - Zero Forcing (ZF) Equalization and Minimum Mean Square Error (MMSE) Equalization.

### Equaliser simulation

The following parameters can be varied as part of this simulation:

- Modulation scheme: You can choose from among BPSK, QPSK, 16-QAM and 64-QAM y clicking on the box comtaining the scheme
- No. of transmit and receive antennas: This experiment uses a MIMO system for communication and you are allowed to choose the no. of antennas in the $T_X$ and $R_X$
- SNR (dB): You can adjust the signal-to-noise ratio to analyse the performance of the receivers under different noise powers.
- Equaliser type: You can choose which equaliser you want to use for the current simulation

Once you select all the desired inputs, click **Run with New Symbols** to execute the simulation. In the center of the screen you can see a block diagram of the system, containing the symbol values at different stages of propagation.

There are 3 plots on the bottom of the experiment window. These are constellation diagrams of the transmitted, received and equalised symbol sequences. You can see a quantitative analysis of the equaliser performance on the right side, where the **Symbol Error Rate (SER)**, **No. of Symbols in Error** and **Channel Condition Number** are given.

You can run this simulation as many times as necessary for different input values. Try using both ZF and MMSE on the same set of symbols and notice qualitatively that MMSE performs better than ZF in most cases.

### Performance Analysis
For a more thorough quantitative analysis of the equalisation schemes, use this tab. You can obtain and plot the SER vs SNR curve for various different values of inputs. For example, you can plot the curve for ZF and MMSE schemes for the same values of modulation, transmit antennas, receive antennas and noise enhancement factor and note the difference in performance from the plot.
