/// <reference path="../../../sdk/mcterm.d.ts" />
import { render } from 'solid-js/web'
import { createSignal, onCleanup } from 'solid-js'
import './app.css'

function App() {
  let ta!: HTMLTextAreaElement
  const [text, setText] = createSignal('')

  const title = () => {
    const first = text().split('\n')[0].trim().slice(0, 24)
    mcterm.setTitle(first ? 'Scratchpad — ' + first : 'Scratchpad')
  }

  mcterm.onState((s) => {
    if (typeof s?.text === 'string') { setText(s.text); title() }
  })
  mcterm.onFocus(() => ta.focus())

  let t: ReturnType<typeof setTimeout>
  const onInput = () => {
    setText(ta.value)
    clearTimeout(t)
    t = setTimeout(() => { mcterm.saveState({ text: text() }); title() }, 400)
  }
  onCleanup(() => clearTimeout(t))

  return (
    <textarea ref={ta} placeholder="scratch space — persists across restarts"
      spellcheck={false} autofocus value={text()} onInput={onInput} />
  )
}

render(App, document.getElementById('root')!)
