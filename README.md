[audio-worklet-playground](https://dirkarnez.github.io/audio-worklet-playground)
================================================================================
<kbd>[**vscode-web-action**](https://github.com/dirkarnez/vscode-web-action/actions/workflows/vscode-web.yml)</kbd><br>

### TODOs
- MessagePort
- Mic
  - ```html
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Distortion — Gain Knob</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 20px; max-width: 640px; margin: auto; }
        .controls { display:flex; gap:16px; align-items:center; margin-top:18px; }
        .knob { display:flex; flex-direction:column; align-items:center; }
        input[type="range"] { width:220px; }
        button { padding:8px 12px; }
        .status { margin-top:12px; color:#555; }
      </style>
    </head>
    <body>
      <h1>Distortion + Gain knob</h1>
    
      <p>Click "Start audio" to load the worklet and start a test tone. Toggle to use your microphone instead of the oscillator.</p>
    
      <div class="controls">
        <div>
          <button id="startBtn">Start audio</button>
          <label style="margin-left:8px;">
            <input type="checkbox" id="useMic"> Use microphone
          </label>
        </div>
    
        <div class="knob">
          <label for="gainRange">Gain: <span id="gainValue">1</span></label>
          <input id="gainRange" type="range" min="1" max="100" step="1" value="1">
        </div>
      </div>
    
      <div class="status" id="status">idle</div>
    
      <script>
        let audioCtx = null;
        let workletNode = null;
        let source = null;
        let micStream = null;
    
        const startBtn = document.getElementById('startBtn');
        const useMic = document.getElementById('useMic');
        const gainRange = document.getElementById('gainRange');
        const gainValue = document.getElementById('gainValue');
        const status = document.getElementById('status');
    
        gainValue.textContent = gainRange.value;
    
        async function startAudio() {
          if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          }
    
          // Ensure user gesture resumed context
          if (audioCtx.state === 'suspended') await audioCtx.resume();
    
          status.textContent = 'loading worklet...';
    
          try {
            // Load the worklet module — adjust path if your processor is elsewhere
            await audioCtx.audioWorklet.addModule('distortion-processor.js');
          } catch (err) {
            status.textContent = 'Error loading worklet: ' + err;
            console.error(err);
            return;
          }
    
          // Create AudioWorkletNode with default parameter value
          workletNode = new AudioWorkletNode(audioCtx, 'distortion-processor', {
            parameterData: { gain: Number(gainRange.value) }
          });
    
          // Create source: microphone or oscillator
          if (useMic.checked) {
            status.textContent = 'requesting microphone...';
            try {
              micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              source = audioCtx.createMediaStreamSource(micStream);
            } catch (err) {
              status.textContent = 'Microphone access denied or error: ' + err;
              console.error(err);
              return;
            }
          } else {
            // Test tone
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 220;
            osc.start();
            source = osc;
          }
    
          // Connect: source -> worklet -> destination
          source.connect(workletNode);
          workletNode.connect(audioCtx.destination);
    
          // Hook up gain control to the audioParam
          const gainParam = workletNode.parameters.get('gain');
          gainParam.setValueAtTime(Number(gainRange.value), audioCtx.currentTime);
    
          // Update knob events
          gainRange.oninput = () => {
            const v = Number(gainRange.value);
            gainValue.textContent = v;
            // Smoothly ramp to new value
            gainParam.cancelScheduledValues(audioCtx.currentTime);
            gainParam.linearRampToValueAtTime(v, audioCtx.currentTime + 0.02);
          };
    
          startBtn.textContent = 'Stop audio';
          status.textContent = 'running';
          startBtn.onclick = stopAudio;
        }
    
        function stopAudio() {
          if (source) {
            try {
              source.disconnect();
            } catch (e) {}
            if (source.stop) source.stop();
            source = null;
          }
          if (workletNode) {
            try { workletNode.disconnect(); } catch(e){}
            workletNode = null;
          }
          if (micStream) {
            for (const t of micStream.getTracks()) t.stop();
            micStream = null;
          }
          status.textContent = 'stopped';
          startBtn.textContent = 'Start audio';
          startBtn.onclick = startAudio;
        }
    
        startBtn.onclick = startAudio;
      </script>
    </body>
    </html>
    ```
- emscripten
  - `emcc dsp.c -o dsp-worklet.js -sENVIRONMENT=worker -sSINGLE_FILE=1 -sEXPORT_ES6=1`, or
  - side module
    - `emcc dsp.c -o dsp.wasm -sSIDE_MODULE=1 -O3 -sEXPORTED_FUNCTIONS="['_process_audio', '_init_dsp']"`
    - ```js
      class EmscriptenAudioProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.port.onmessage = (e) => {
            if (e.data.type === 'MODULE') {
              this.initWasm(e.data.wasmBytes);
            }
          };
        }

        async initWasm(wasmBytes) {
          // Compile and instantiate the standalone Wasm module
          const { instance } = await WebAssembly.instantiate(wasmBytes, {
            env: {
              memory: new WebAssembly.Memory({ initial: 256, maximum: 256 }),
              abort: () => console.log("Abort called")
            }
          });
          
          this.wasm = instance.exports;
          this.wasm._init_dsp();
          
          // Create Float32 views into Wasm memory for audio buffers if needed
          this.wasmMemory = instance.exports.memory;
        }

        process(inputs, outputs, parameters) {
          if (!this.wasm) return true; // Wait until Wasm is loaded

          const input = inputs[0];
          const output = outputs[0];

          // Example: Pass channel data pointers to your Wasm dsp function
          // You would copy input data to Wasm memory, call _process_audio, and copy back to output
          
          return true;
        }
      }

      registerProcessor('emscripten-audio-processor', EmscriptenAudioProcessor);
      ```
    - `emcc dsp.cpp -o dsp.wasm -sSIDE_MODULE=1 -O3`
      - ```js
        class ZeroCopyProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.wasmLoaded = false;
            this.port.onmessage = async (e) => {
              if (e.data.type === 'INIT') await this.initWasm(e.data.wasmBytes);
            };
          }

          async initWasm(wasmBytes) {
            this.memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
            const { instance } = await WebAssembly.instantiate(wasmBytes, {
              env: { memory: this.memory, abort: () => {} }
            });

            const exports = instance.exports;

            // Get the raw byte offsets from C++
            const inputOffset = exports.get_input_ptr();
            const outputOffset = exports.get_output_ptr();

            // Create views targeting the EXACT memory addresses inside the Wasm Heap
            // No data is copied here; these are just structural lenses pointing at C++ memory
            this.wasmInput = new Float32Array(this.memory.buffer, inputOffset, 128);
            this.wasmOutput = new Float32Array(this.memory.buffer, outputOffset, 128);

            this.executeDsp = exports.process_audio;
            this.wasmLoaded = true;
          }

          process(inputs, outputs) {
            if (!this.wasmLoaded) return true;

            const webAudioInput = inputs[0]?.[0];
            const webAudioOutput = outputs[0]?.[0];

            if (!webAudioInput || !webAudioOutput) return true;

            // --- ZERO COPY BRIDGE ---
            // Instead of copying arrays, read/write directly across the memory boundary
            for (let i = 0; i < 128; ++i) {
              this.wasmInput[i] = webAudioInput[i]; // Write straight into C++ memory
            }

            // Execute the C++ DSP math over its own memory space
            this.executeDsp();

            for (let i = 0; i < 128; ++i) {
              webAudioOutput[i] = this.wasmOutput[i]; // Read straight out of C++ memory
            }

            return true;
          }
        }

        registerProcessor('zero-copy-processor', ZeroCopyProcessor);

        ```
      - ```c
        #include <emscripten.h>

        #define BUFFER_SIZE 128

        // Pre-allocate the input and output blocks inside the Wasm Linear Heap
        float input_buffer[BUFFER_SIZE];
        float output_buffer[BUFFER_SIZE];

        // Internal DSP State
        float filter_state = 0.0f;
        float cutoff = 0.3f;

        extern "C" {

            // JavaScript will call this to find WHERE the input buffer lives in Wasm memory
            EMSCRIPTEN_KEEPALIVE
            float* get_input_ptr() {
                return input_buffer;
            }

            // JavaScript will call this to find WHERE the output buffer lives in Wasm memory
            EMSCRIPTEN_KEEPALIVE
            float* get_output_ptr() {
                return output_buffer;
            }

            // This loop runs with ZERO memory copying
            EMSCRIPTEN_KEEPALIVE
            void process_audio() {
                for (int i = 0; i < BUFFER_SIZE; ++i) {
                    // Read directly from the heap memory location that JS wrote to
                    filter_state += cutoff * (input_buffer[i] - filter_state);
                    
                    // Write directly to the heap memory location that JS will read from
                    output_buffer[i] = filter_state;
                }
            }
        }
        ```

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
