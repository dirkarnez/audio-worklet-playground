audio-worklet-playground
========================
<kbd>[**vscode-web-action**](https://github.com/dirkarnez/vscode-web-action/actions/workflows/vscode-web.yml)</kbd><br>


MessagePort
https://github.com/GoogleChromeLabs/web-audio-samples/blob/main/src/audio-worklet/basic/one-pole-filter/main.js
https://github.com/GoogleChromeLabs/web-audio-samples/blob/main/src/audio-worklet/basic/message-port/main.js
```
class SimpleGainProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'gain', defaultValue: 1, minValue: 0, maxValue: 10 }];
  }

  constructor() {
    super();
    // optional: receive messages from main thread
    this.port.onmessage = (e) => {
      // handle messages if needed
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const gainParam = parameters.gain;

    // For each channel
    for (let ch = 0; ch < output.length; ch++) {
      const inChannel = input[ch] || input[0]; // fallback if fewer input channels
      const outChannel = output[ch];

      if (!inChannel) {
        // if no input channel, produce silence
        outChannel.fill(0);
        continue;
      }

      if (gainParam.length === 1) {
        // single value for whole block
        const g = gainParam[0];
        for (let i = 0; i < outChannel.length; i++) outChannel[i] = inChannel[i] * g;
      } else {
        // per-sample automation
        for (let i = 0; i < outChannel.length; i++) outChannel[i] = inChannel[i] * gainParam[i];
      }
    }

    return true; // keep processor alive
  }
}

registerProcessor('simple-gain-processor', SimpleGainProcessor);
```
```
async function playBufferThroughWorklet() {
  const ac = new AudioContext();

  // 1) load the AudioWorkletProcessor module
  await ac.audioWorklet.addModule('processor.js');

  // 2) create the worklet node; declare channel counts if needed
  const workletNode = new AudioWorkletNode(ac, 'simple-gain-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2] // request stereo output
  });

  // Connect the worklet to destination
  workletNode.connect(ac.destination);

  // 3) create a buffer and fill it (2s stereo sine at 440Hz)
  const duration = 2; // seconds
  const sampleRate = ac.sampleRate;
  const channels = 2;
  const buffer = ac.createBuffer(channels, duration * sampleRate, sampleRate);

  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      data[i] = Math.sin(2 * Math.PI * 440 * t) * (ch === 0 ? 1 : 0.6);
    }
  }

  // 4) create the source, connect it to the worklet, and start
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.connect(workletNode);
  src.start();

  // 5) control worklet parameters (AudioParam)
  const gainParam = workletNode.parameters.get('gain');
  gainParam.setValueAtTime(0.5, ac.currentTime); // start at 0.5
  gainParam.linearRampToValueAtTime(1.0, ac.currentTime + 1.5); // ramp up

  // Note: BufferSourceNodes are one-shot — to play again create a new source.
}

playBufferThroughWorklet();
```
