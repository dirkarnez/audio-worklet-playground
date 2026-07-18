class DistortionProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{
      name: 'gain',
      defaultValue: 1,
      minValue: 1,
      maxValue: 100
    }];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const gain = parameters.gain;

    // Loop through all audio channels (e.g., Left and Right)
    for (let channel = 0; channel < input.length; ++channel) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      // Process each individual audio sample
      for (let i = 0; i < inputChannel.length; ++i) {
        // 1. Amplify the input signal
        let signal = inputChannel[i]//  * gain[i]; 
        
        // 2. Hard clip the signal between -1.0 and 1.0
        outputChannel[i] = signal // Math.max(-1.0, Math.min(1.0, signal));
      }
    }
    return true;
  }
}

registerProcessor('distortion-processor', DistortionProcessor);