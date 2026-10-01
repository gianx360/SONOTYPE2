(() => {
  'use strict';

  const $ = s => document.querySelector(s);

  const names = [
    'C', 'C#', 'D', 'D#', 'E', 'F',
    'F#', 'G', 'G#', 'A', 'A#', 'B'
  ];

  const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10]
  };

  /* =========================================================
     KEY MENU
     ========================================================= */

  for (let i = 0; i < 12; i++) {
    $('#key').add(new Option(names[i], i));
  }


  /* =========================================================
     STATE
     ========================================================= */

  let beat = {
    kick: Array(16).fill(false),
    snare: Array(16).fill(false),
    hat: Array(16).fill(false)
  };

  let ctx = null;
  let nodes = [];
  let clock = null;
  let currentStep = 0;
  let cycleTimer = null;


  /* =========================================================
     HASH
     ========================================================= */

  function hash(s, seed = 0) {

    let h = (2166136261 ^ seed) >>> 0;

    for (const c of Array.from(s || ' ')) {
      h ^= c.codePointAt(0);
      h = Math.imul(h, 16777619);
    }

    return h >>> 0;
  }


  /* =========================================================
     BEAT GENERATOR
     ========================================================= */

  function genBeat() {

    const s = $('#text').value || ' ';

    for (let i = 0; i < 16; i++) {

      const h = hash(s, i + 1);

      beat.kick[i] =
        i === 0 ||
        i === 8 ||
        h % 13 === 0;

      beat.snare[i] =
        i === 4 ||
        i === 12 ||
        (h >>> 5) % 37 === 0;

      beat.hat[i] =
        i % 2 === 0 ||
        h % 9 === 0;
    }

    drawBeat();
    summary();
  }


  /* =========================================================
     BEAT EDITOR
     ========================================================= */

  function drawBeat() {

    const g = $('#beatGrid');

    g.innerHTML = '';

    [
      ['KICK', 'kick'],
      ['SNARE', 'snare'],
      ['HAT', 'hat']
    ].forEach(([lab, key]) => {

      const row = document.createElement('div');

      row.className = 'beatrow';

      const l = document.createElement('span');

      l.textContent = lab;

      row.append(l);

      for (let i = 0; i < 16; i++) {

        const b = document.createElement('button');

        b.className =
          'step' +
          (beat[key][i] ? ' on' : '');

        b.title =
          lab +
          ' step ' +
          (i + 1);

        b.addEventListener('click', () => {

          beat[key][i] =
            !beat[key][i];

          drawBeat();
        });

        row.append(b);
      }

      g.append(row);
    });
  }


  /* =========================================================
     COMPOSITION ENGINE
     ========================================================= */

  function comp() {

    const chars =
      Array.from($('#text').value || ' ');

    const ints =
      scales[$('#scale').value];

    const root =
      +$('#key').value;

    const bars =
      +$('#bars').value;

    const total =
      bars * 4;

    const durs =
      [.25, .5, .5, .75, 1];

    const mel = [];

    let pos = 0;
    let n = 0;

    while (
      pos < total &&
      n < 500
    ) {

      const ch =
        chars[n % chars.length] || ' ';

      const h =
        hash(ch, n + 19);

      const dur =
        Math.min(
          durs[h % durs.length],
          total - pos
        );

      const degree =
        (h >>> 5) % 7;

      const midi =
        60 +
        root +
        ints[degree] +
        12 * ((h >>> 9) % 2);

      mel.push({

        pos,
        dur,
        midi,

        rest:
          /\s/u.test(ch) ||
          h % 29 === 0,

        label:
          names[midi % 12] +
          (Math.floor(midi / 12) - 1)
      });

      pos += dur;
      n++;
    }


    const chords = [];

    for (
      let b = 0;
      b < bars;
      b++
    ) {

      const degree =
        hash(
          $('#text').value,
          b + 100
        ) % 7;

      const notes =
        [0, 2, 4].map(o => {

          const d =
            degree + o;

          return (
            48 +
            root +
            ints[d % 7] +
            12 * Math.floor(d / 7)
          );
        });

      chords.push({

        pos: b * 4,

        notes,

        label:
          names[
            (root + ints[degree]) % 12
          ]
      });
    }

    return {
      mel,
      chords,
      bars,
      total
    };
  }


  /* =========================================================
     SUMMARY
     ========================================================= */

  function summary() {

    const c = comp();

    $('#summary').textContent =
      `${c.bars} bars · ` +
      `${c.mel.length} melody events · ` +
      `editable 16-step drums`;
  }


  /* =========================================================
     AUDIO HELPERS
     ========================================================= */

  function freq(m) {

    return (
      440 *
      Math.pow(
        2,
        (m - 69) / 12
      )
    );
  }


  function tone(
    ac,
    m,
    t,
    d,
    g,
    type,
    dest,
    collector
  ) {

    const o =
      ac.createOscillator();

    const a =
      ac.createGain();

    o.type =
      type === 'pluck'
        ? 'triangle'
        : type;

    o.frequency.value =
      freq(m);

    a.gain.setValueAtTime(
      .0001,
      t
    );

    a.gain.exponentialRampToValueAtTime(
      g,
      t +
      (
        type === 'pluck'
          ? .004
          : .015
      )
    );

    a.gain.exponentialRampToValueAtTime(
      .0001,
      t + Math.max(.03, d)
    );

    o.connect(a).connect(dest);

    o.start(t);
    o.stop(t + d + .03);

    collector.push(o);
  }


  function kick(
    ac,
    t,
    dest,
    collector
  ) {

    const mode =
      $('#drumSound').value;

    const o =
      ac.createOscillator();

    const a =
      ac.createGain();

    o.frequency.setValueAtTime(
      mode === 'heavy'
        ? 170
        : mode === 'electro'
          ? 155
          : 135,
      t
    );

    o.frequency.exponentialRampToValueAtTime(
      mode === 'electro'
        ? 38
        : 48,
      t + .14
    );

    a.gain.setValueAtTime(
      mode === 'soft'
        ? .25
        : .5,
      t
    );

    a.gain.exponentialRampToValueAtTime(
      .001,
      t + .18
    );

    o.connect(a).connect(dest);

    o.start(t);
    o.stop(t + .2);

    collector.push(o);
  }


  function noise(
    ac,
    t,
    d,
    g,
    hp,
    dest,
    collector
  ) {

    const b =
      ac.createBuffer(
        1,
        Math.max(
          1,
          Math.floor(
            ac.sampleRate * d
          )
        ),
        ac.sampleRate
      );

    const v =
      b.getChannelData(0);

    for (
      let i = 0;
      i < v.length;
      i++
    ) {
      v[i] =
        Math.random() * 2 - 1;
    }

    const s =
      ac.createBufferSource();

    const f =
      ac.createBiquadFilter();

    const a =
      ac.createGain();

    s.buffer = b;

    f.type = 'highpass';

    f.frequency.value = hp;

    a.gain.setValueAtTime(
      g,
      t
    );

    a.gain.exponentialRampToValueAtTime(
      .001,
      t + d
    );

    s
      .connect(f)
      .connect(a)
      .connect(dest);

    s.start(t);
    s.stop(t + d);

    collector.push(s);
  }


  /* =========================================================
     SCHEDULER
     ========================================================= */

  function schedule(
    ac,
    start,
    loops,
    dest,
    collector
  ) {

    const c = comp();

    const spb =
      60 / +$('#bpm').value;

    const cycle =
      c.total * spb;


    for (
      let lp = 0;
      lp < loops;
      lp++
    ) {

      const base =
        start + lp * cycle;


      /* CHORDS */

      if ($('#chOn').checked) {

        c.chords.forEach(ch => {

          ch.notes.forEach(m => {

            tone(
              ac,
              m,
              base + ch.pos * spb,
              3.85 * spb,
              .03,
              $('#chSound').value,
              dest,
              collector
            );
          });
        });
      }


      /* MELODY */

      if ($('#melOn').checked) {

        c.mel.forEach(e => {

          if (!e.rest) {

            tone(
              ac,
              e.midi,
              base + e.pos * spb,
              e.dur * spb * .86,
              .1,
              $('#melSound').value,
              dest,
              collector
            );
          }
        });
      }


      /* DRUMS */

      if ($('#drumOn').checked) {

        for (
          let bar = 0;
          bar < c.bars;
          bar++
        ) {

          for (
            let i = 0;
            i < 16;
            i++
          ) {

            const t =
              base +
              (
                bar * 4 +
                i * .25
              ) *
              spb;


            if (beat.kick[i]) {

              kick(
                ac,
                t,
                dest,
                collector
              );
            }


            if (beat.snare[i]) {

              noise(
                ac,
                t,
                .1,
                .14,
                1300,
                dest,
                collector
              );
            }


            if (beat.hat[i]) {

              noise(
                ac,
                t,
                .035,
                .04,
                5000,
                dest,
                collector
              );
            }
          }
        }
      }
    }

    return cycle;
  }


  /* =========================================================
     STOP
     ========================================================= */

  function stop() {

    if (clock) {
      clearInterval(clock);
    }

    if (cycleTimer) {
      clearTimeout(cycleTimer);
    }

    clock = null;
    cycleTimer = null;

    nodes.forEach(n => {

      try {
        n.stop();
      } catch {}
    });

    nodes = [];

    document
      .querySelectorAll('.current')
      .forEach(
        x =>
          x.classList.remove('current')
      );

    $('#nowNote').textContent =
      '—';

    $('#nowChord').textContent =
      '—';

    $('#nowStep').textContent =
      '—';

    $('#status').textContent =
      'STOPPED';
  }


  /* =========================================================
     PLAY
     ========================================================= */

  async function play() {

    stop();

    const AC =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AC) {

      return alert(
        'Web Audio is unavailable in this browser.'
      );
    }

    ctx =
      ctx || new AC();

    await ctx.resume();

    const c =
      comp();

    const spb =
      60 / +$('#bpm').value;

    const cycle =
      schedule(
        ctx,
        ctx.currentTime + .07,
        1,
        ctx.destination,
        nodes
      );

    currentStep = 0;


    clock =
      setInterval(() => {

        document
          .querySelectorAll('.current')
          .forEach(
            x =>
              x.classList.remove(
                'current'
              )
          );


        const idx =
          currentStep % 16;


        document
          .querySelectorAll(
            '.beatrow'
          )
          .forEach(r => {

            r.children[
              idx + 1
            ]?.classList.add(
              'current'
            );
          });


        const pos =
          (
            currentStep * .25
          ) %
          c.total;


        $('#nowStep').textContent =
          String(idx + 1)
            .padStart(2, '0');


        const e =
          c.mel.find(
            x =>
              pos >= x.pos &&
              pos <
              x.pos + x.dur
          );


        $('#nowNote').textContent =
          e
            ? (
                e.rest
                  ? '·'
                  : e.label
              )
            : '·';


        $('#nowChord').textContent =
          c.chords[
            Math.min(
              Math.floor(pos / 4),
              c.chords.length - 1
            )
          ].label;


        currentStep++;

      }, spb * 250);


    const repeat = () => {

      cycleTimer =
        setTimeout(() => {

          if ($('#loop').checked) {

            schedule(
              ctx,
              ctx.currentTime + .03,
              1,
              ctx.destination,
              nodes
            );

            repeat();

          } else {

            stop();
          }

        }, cycle * 1000);
    };


    repeat();

    $('#status').textContent =
      'PLAYING';
  }


  /* =========================================================
     MIDI HELPERS
     ========================================================= */

  function vlq(n) {

    let a =
      [n & 127];

    while (
      (n >>= 7) > 0
    ) {

      a.unshift(
        (n & 127) | 128
      );
    }

    return a;
  }


  function be(n, l) {

    const a = [];

    for (
      let i = l - 1;
      i >= 0;
      i--
    ) {

      a.push(
        (n >> (i * 8)) & 255
      );
    }

    return a;
  }


  function download(
    blob,
    name
  ) {

    const u =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = u;
    a.download = name;

    document.body.append(a);

    a.click();

    a.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(u),
      1200
    );
  }


  /* =========================================================
     MIDI EXPORT
     ========================================================= */

  function midi() {

    const c =
      comp();

    const tpq =
      480;

    const ev = [];

    const add =
      (tick, data) =>
        ev.push({
          tick,
          data
        });


    c.mel.forEach(e => {

      if (!e.rest) {

        const t =
          Math.round(
            e.pos * tpq
          );

        const d =
          Math.max(
            1,
            Math.round(
              e.dur *
              tpq *
              .85
            )
          );

        add(
          t,
          [
            0x90,
            e.midi,
            90
          ]
        );

        add(
          t + d,
          [
            0x80,
            e.midi,
            0
          ]
        );
      }
    });


    c.chords.forEach(ch => {

      ch.notes.forEach(m => {

        const t =
          Math.round(
            ch.pos * tpq
          );

        add(
          t,
          [
            0x91,
            m,
            55
          ]
        );

        add(
          t +
          Math.round(
            3.8 * tpq
          ),
          [
            0x81,
            m,
            0
          ]
        );
      });
    });


    for (
      let bar = 0;
      bar < c.bars;
      bar++
    ) {

      for (
        let i = 0;
        i < 16;
        i++
      ) {

        const t =
          Math.round(
            (
              bar * 4 +
              i * .25
            ) *
            tpq
          );

        const off =
          t + 50;


        if (beat.kick[i]) {

          add(
            t,
            [
              0x99,
              36,
              110
            ]
          );

          add(
            off,
            [
              0x89,
              36,
              0
            ]
          );
        }


        if (beat.snare[i]) {

          add(
            t,
            [
              0x99,
              38,
              95
            ]
          );

          add(
            off,
            [
              0x89,
              38,
              0
            ]
          );
        }


        if (beat.hat[i]) {

          add(
            t,
            [
              0x99,
              42,
              65
            ]
          );

          add(
            off,
            [
              0x89,
              42,
              0
            ]
          );
        }
      }
    }


    ev.sort(
      (a, b) =>
        a.tick - b.tick
    );


    const tr = [];

    const tempo =
      Math.round(
        60000000 /
        +$('#bpm').value
      );


    tr.push(
      0,
      0xff,
      0x51,
      3,
      ...be(tempo, 3)
    );


    let last = 0;


    ev.forEach(e => {

      tr.push(
        ...vlq(
          e.tick - last
        ),
        ...e.data
      );

      last =
        e.tick;
    });


    tr.push(
      0,
      0xff,
      0x2f,
      0
    );


    const bytes = [

      77, 84, 104, 100,

      ...be(6, 4),

      0, 0,

      0, 1,

      ...be(tpq, 2),

      77, 84, 114, 107,

      ...be(
        tr.length,
        4
      ),

      ...tr
    ];


    download(
      new Blob(
        [
          new Uint8Array(
            bytes
          )
        ],
        {
          type:
            'audio/midi'
        }
      ),
      'sonotype-studio.mid'
    );


    $('#status').textContent =
      'MIDI EXPORTED';
  }


  /* =========================================================
     WAV EXPORT
     ========================================================= */

  async function wav() {

    const Offline =
      window.OfflineAudioContext ||
      window.webkitOfflineAudioContext;


    if (!Offline) {

      return alert(
        'Offline audio rendering is unavailable in this browser.'
      );
    }


    const c =
      comp();

    const loops =
      +$('#wavLoops').value;

    const spb =
      60 / +$('#bpm').value;

    const seconds =
      c.total *
      spb *
      loops +
      .35;

    const sr =
      44100;


    const off =
      new Offline(
        2,
        Math.ceil(
          seconds * sr
        ),
        sr
      );


    const tmp = [];


    $('#status').textContent =
      `RENDERING ${loops} LOOP${loops > 1 ? 'S' : ''}…`;


    schedule(
      off,
      .04,
      loops,
      off.destination,
      tmp
    );


    const rendered =
      await off.startRendering();


    const channels =
      rendered.numberOfChannels;

    const len =
      rendered.length;


    const ab =
      new ArrayBuffer(
        44 +
        len *
        channels *
        2
      );


    const v =
      new DataView(ab);


    let p = 0;


    const str = s => {

      for (const x of s) {

        v.setUint8(
          p++,
          x.charCodeAt()
        );
      }
    };


    const u16 = n => {

      v.setUint16(
        p,
        n,
        true
      );

      p += 2;
    };


    const u32 = n => {

      v.setUint32(
        p,
        n,
        true
      );

      p += 4;
    };


    str('RIFF');

    u32(
      36 +
      len *
      channels *
      2
    );

    str('WAVE');

    str('fmt ');

    u32(16);

    u16(1);

    u16(channels);

    u32(sr);

    u32(
      sr *
      channels *
      2
    );

    u16(
      channels * 2
    );

    u16(16);

    str('data');

    u32(
      len *
      channels *
      2
    );


    for (
      let i = 0;
      i < len;
      i++
    ) {

      for (
        let ch = 0;
        ch < channels;
        ch++
      ) {

        let s =
          Math.max(
            -1,
            Math.min(
              1,
              rendered
                .getChannelData(ch)[i]
            )
          );


        v.setInt16(
          p,
          s < 0
            ? s * 32768
            : s * 32767,
          true
        );


        p += 2;
      }
    }


    download(
      new Blob(
        [ab],
        {
          type:
            'audio/wav'
        }
      ),
      `sonotype-${loops}-loops.wav`
    );


    $('#status').textContent =
      `WAV EXPORTED · ${loops} LOOP${loops > 1 ? 'S' : ''}`;
  }


  /* =========================================================
     COMPOSITION ID — ST1
     ========================================================= */


  /*
     ST1 stores:

     source text
     key
     scale
     BPM
     bars

     melody sound
     chord sound
     drum sound

     melody on/off
     chords on/off
     drums on/off

     WAV export loops

     manually edited:
     kick
     snare
     hi-hat
  */


  function beatToString(arr) {

    return arr
      .map(
        value =>
          value ? '1' : '0'
      )
      .join('');
  }


  function stringToBeat(value) {

    if (
      typeof value !== 'string' ||
      value.length !== 16 ||
      !/^[01]{16}$/.test(value)
    ) {

      throw new Error(
        'Invalid beat pattern'
      );
    }


    return Array.from(
      value,
      value =>
        value === '1'
    );
  }


  /*
     UTF-8 safe Base64 encoding.
  */

  function encodeBase64(value) {

    const bytes =
      new TextEncoder()
        .encode(value);


    let binary = '';


    for (const byte of bytes) {

      binary +=
        String.fromCharCode(byte);
    }


    return btoa(binary);
  }


  function decodeBase64(value) {

    const binary =
      atob(value);


    const bytes =
      Uint8Array.from(
        binary,
        char =>
          char.charCodeAt(0)
      );


    return new TextDecoder()
      .decode(bytes);
  }


  /*
     Convert ordinary Base64 into
     URL/reference-safe Base64.
  */

  function toBase64URL(value) {

    return value
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }


  function fromBase64URL(value) {

    let base64 =
      value
        .replace(/-/g, '+')
        .replace(/_/g, '/');


    while (
      base64.length % 4
    ) {

      base64 += '=';
    }


    return base64;
  }


  /*
     Capture the entire composition.
  */

  function getCompositionState() {

    return {

      v: 1,

      text:
        $('#text').value,

      key:
        +$('#key').value,

      scale:
        $('#scale').value,

      bpm:
        +$('#bpm').value,

      bars:
        +$('#bars').value,

      melSound:
        $('#melSound').value,

      chSound:
        $('#chSound').value,

      drumSound:
        $('#drumSound').value,

      melOn:
        $('#melOn').checked,

      chOn:
        $('#chOn').checked,

      drumOn:
        $('#drumOn').checked,

      wavLoops:
        +$('#wavLoops').value,

      kick:
        beatToString(
          beat.kick
        ),

      snare:
        beatToString(
          beat.snare
        ),

      hat:
        beatToString(
          beat.hat
        )
    };
  }


  /*
     Generate the portable ST1 ID.
  */

  function generateCompositionId() {

    const state =
      getCompositionState();


    const json =
      JSON.stringify(state);


    const encoded =
      toBase64URL(
        encodeBase64(json)
      );


    const id =
      'ST1-' + encoded;


    $('#compositionId').value =
      id;


    $('#compositionIdStatus').textContent =
      'Composition ID generated.';


    $('#status').textContent =
      'COMPOSITION ID READY';


    return id;
  }


  /*
     Load an ST1 ID.
  */

  function loadCompositionId() {

    const raw =
      $('#compositionId')
        .value
        .trim();


    if (!raw) {

      $('#compositionIdStatus').textContent =
        'Paste a Composition ID first.';

      return;
    }


    if (!raw.startsWith('ST1-')) {

      $('#compositionIdStatus').textContent =
        'This is not a valid ST1 Composition ID.';

      return;
    }


    try {

      const encoded =
        raw.slice(4);


      const json =
        decodeBase64(
          fromBase64URL(
            encoded
          )
        );


      const state =
        JSON.parse(json);


      if (
        state.v !== 1
      ) {

        throw new Error(
          'Unsupported version'
        );
      }


      /*
         Restore source.
      */

      $('#text').value =
        state.text ?? '';


      /*
         Restore composition.
      */

      $('#key').value =
        String(state.key);

      $('#scale').value =
        state.scale;

      $('#bpm').value =
        String(state.bpm);

      $('#bars').value =
        String(state.bars);


      /*
         Restore sounds.
      */

      $('#melSound').value =
        state.melSound;

      $('#chSound').value =
        state.chSound;

      $('#drumSound').value =
        state.drumSound;


      /*
         Restore layers.
      */

      $('#melOn').checked =
        Boolean(state.melOn);

      $('#chOn').checked =
        Boolean(state.chOn);

      $('#drumOn').checked =
        Boolean(state.drumOn);


      /*
         Restore WAV export loops.
      */

      $('#wavLoops').value =
        String(
          state.wavLoops || 1
        );


      /*
         Restore MANUALLY EDITED beat.
      */

      beat = {

        kick:
          stringToBeat(
            state.kick
          ),

        snare:
          stringToBeat(
            state.snare
          ),

        hat:
          stringToBeat(
            state.hat
          )
      };


      /*
         Refresh interface.
      */

      $('#bpmOut').textContent =
        $('#bpm').value +
        ' BPM';


      drawBeat();

      summary();


      $('#compositionIdStatus').textContent =
        'Composition restored successfully.';


      $('#status').textContent =
        'COMPOSITION LOADED';


    } catch (error) {

      console.error(error);


      $('#compositionIdStatus').textContent =
        'Could not load this Composition ID.';


      $('#status').textContent =
        'INVALID COMPOSITION ID';
    }
  }


  /*
     Copy Composition ID.
  */

  async function copyCompositionId() {

    let id =
      $('#compositionId')
        .value
        .trim();


    /*
       If there isn't an ID yet,
       automatically generate one.
    */

    if (!id) {

      id =
        generateCompositionId();
    }


    try {

      await navigator.clipboard
        .writeText(id);


      $('#compositionIdStatus').textContent =
        'Composition ID copied to clipboard.';


      $('#status').textContent =
        'ID COPIED';


    } catch {

      /*
         Fallback for browsers where
         Clipboard API isn't available.
      */

      $('#compositionId').select();

      document.execCommand(
        'copy'
      );


      $('#compositionIdStatus').textContent =
        'Composition ID copied to clipboard.';


      $('#status').textContent =
        'ID COPIED';
    }
  }


  /* =========================================================
     EVENTS
     ========================================================= */

  $('#regen').onclick =
    genBeat;


  $('#text')
    .addEventListener(
      'input',
      genBeat
    );


  [
    'key',
    'scale',
    'bars'
  ].forEach(id => {

    $('#' + id)
      .addEventListener(
        'change',
        summary
      );
  });


  $('#bpm').oninput =
    () => {

      $('#bpmOut').textContent =
        $('#bpm').value +
        ' BPM';
    };


  $('#play').onclick =
    play;


  $('#stop').onclick =
    stop;


  $('#midi').onclick =
    midi;


  $('#wav').onclick =
    wav;


  /*
     Composition ID controls
  */

  $('#generateId').onclick =
    generateCompositionId;


  $('#copyId').onclick =
    copyCompositionId;


  $('#loadId').onclick =
    loadCompositionId;


  /* =========================================================
     INITIALISE
     ========================================================= */

  genBeat();

  summary();

})();
