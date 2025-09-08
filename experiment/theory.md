Imagine transmitting a signal $\mathbf{x}$ over an additive white gaussian noise (AWGN) channel. Here, the channel only adds noise, without distorting the signal’s amplitude or phase. The recieved signal here is $\mathbf{y} = \mathbf{x}+\mathbf{n}$. As a result, detection is relatively straightforward. The receiver’s task is simply to handle the noise during detection.

However, in wireless channels, signals do not just see noise but they pass through a fading channel $\mathbf{H}$ resulting in the recieved signal $\mathbf{y} = \mathbf{Hx}+\mathbf{n}$. The channel response  $\mathbf{H}$ is generally complex and thus induces magnitude and phase shifts. Due to this, the constellation points will be shifted and rotated. These distortions must be compensated before decoding. Thus, we need to remove the effect of $\mathbf{H}$ before decoding. To facilitate this, the receiver employs channel equalizers, which act like inverse filters that attempt to cancel out the channel’s effects.

In a narrowband fading channel, the bandwidth of the transmitted signal is small compared to the channel’s coherence bandwidth. This means the channel appears as a single complex gain across the entire signal (i.e. flat fading) — effectively, the same attenuation and phase shift is applied to all frequencies. Equalization in this case is relatively straightforward, since the receiver only needs to invert $\mathbf{H}$ to restore both the amplitude and phase of the transmitted signal.

In contrast, in wideband wireless communication, a fundamental challenge is frequency-selective fading, which occurs when delay spread of the wireless channel is significantly larger compared to the symbol duration. Because wideband signals occupy a large bandwidth, their symbol duration is short. When the delay spread of the multipath components is larger than the symbol duration, adjacent symbols tend to overlap in the superposition of the recieved multiple delayed copies of the signal. This phenomenon is called Inter-Symbol Interference (ISI). From a frequency-domain perspective, the received signal can be expressed as $\mathbf{Y}(f) = \mathbf{H}(f)\mathbf{X}(f) + \mathbf{N}(f)$, where $\mathbf{H}(f)$ varies with frequency. Thus, the distortion is not only in amplitude and phase but is also frequency-selective, meaning different parts of the signal spectrum are affected differently. ISI severely degrades system performance because symbols interfere with one another, making reliable detection difficult. To address ISI in frequency-selective fading channels, several techniques are commonly employed, including:
  1) **Channel Equalization** - The equalizers are used on the reciever side to reverse the effects of the channel and recover the transmitted signal. 
  2) Multi-Carrier Modulation - Splitting the wideband channel into multiple narrowband subcarriers. 
  3) Spread Spectrum - Spreading the signal over a wide frequency band to reduce the impact of fading on any particular frequency component.

In this experiment, we study channel equalization in narrowband fading scenario. The following diagram shows equalizer equipped MIMO systems.

<img src=".\images\exp8.png">



The signal arriving at the reciever can be modeled as

$$
\begin{aligned}
  \mathbf{y} = \mathbf{H}\mathbf{x} + \mathbf{n}
\end{aligned}
$$

where $\mathbf{x}$ is the transmitted symbol vector and $n$ is the awgn noise.

This experiment focuses on channel equalization i.e removing the effect on $\mathbf{H}$ on the recieved signal so that it becomes decodable. To do this, we will now describe the two popular equalization techniques: 
  1) Zero Forcing (ZF) equalizer and
  2) Minimum Mean Square Error (MMSE) equalizer.

These methods are implemented to mitigate the channel impact, and each has distinct characteristics in terms of handling noise and channel response.

## ZF Equalizer

ZF equalizer is a fundamental technique designed to completely reverse the impact of the channel on the received signal. It achieves this by applying a filter that is the inverse of the channel’s frequency response. Mathematically, the ZF equalizer is defined by a filter 

$$
\begin{aligned}
     W_{ZF} = \mathbf{H}^{-1}. 
\end{aligned}
$$

The recieved signal after ZF equalization reduces to

$$
\begin{aligned}
  \hat{\mathbf{y}} = W_{ZF}\mathbf{y} = \mathbf{x} + \mathbf{H}^{-1}\mathbf{n}.
\end{aligned}
$$

The ZF equalizer restores the transmitted signal by "forcing" the effect of the channel to zero on desired component. However, we can observe from the above equation that this approach has a significant drawback: when the channel gain is small or near zero, the ZF equalizer amplifies the noise component in the received signal. This issue is particularly problematic in low Signal-to-Noise Ratio (SNR) regimes. Thus ZF equalizer usually has poor bit error rate (BER) performance in low SNR regimes. To combat for this, we move to understand MMSE equalizer.

## MMSE Equalizer

MMSE equalizer is designed to optimize signal recovery by balancing the trade-off between channel inversion and noise amplification. Unlike the ZF equalizer, the MMSE equalizer does not completely negate the channel's impact; instead, it minimizes the mean square error between the transmitted and estimated symbols. The linear MMSE filter is given by

$$
\begin{aligned}
   W_{MMSE} = \left(H^HH + \sigma_n^2I\right)^{-1}H^H,
\end{aligned}
$$

where $\sigma_n^2$ is the noise variance.

The recieved signal after MMSE equalization reduces to

$$
\begin{aligned}
  \hat{\mathbf{y}} = W_{MMSE}\mathbf{y} = \left(H^HH + \sigma_n^2I\right)^{-1}H^H \mathbf{x} + \left(H^HH + \sigma_n^2I\right)^{-1}H^H\mathbf{n}.
\end{aligned}
$$

The MMSE equalizer provides a better balance between channel inversion and noise amplification by scaling the recieved signal with $\left(H^HH + \sigma_n^2I\right)^{-1}H^H$. Because of this scaling, the SNR of the equalized and originally recieved signal remain unchanged. However, it is interesting to note that when chnannel is poor (i.e $H^HH \approx 0$), the term  $\sigma_n^2I$ will restrict the noise amplification. On the contrary, when channel is good (i.e $H^HH$ >> $\sigma_n^2I$), MMSE equalizer reduces to ZF equalizer. Thus, we observe that MMSE provides additional benefits in low SNR regime while performing on par with ZF under good channel conditions.


## Comparative Performance of ZF and MMSE Equalizers

In this experiment, we will compare the ZF and MMSE equalizers by implementing them and observing their performance across different SNR conditions. The ZF equalizer will illustrate the effect of noise amplification, particularly in low SNR, while the MMSE equalizer will demonstrate better BER performance by minimizing the impact of noise. Through this comparison, the experiment aims to highlight the trade-offs involved in selecting equalization techniques for wireless communication systems.
