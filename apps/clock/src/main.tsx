/// <reference path="../../../sdk/mcterm.d.ts" />
import { render } from 'solid-js/web'
import { createSignal, onCleanup } from 'solid-js'
import './app.css'

function App() {
  const [time, setTime] = createSignal('')
  const [date, setDate] = createSignal('')

  const tick = () => {
    const now = new Date()
    setTime(now.toLocaleTimeString('en-GB'))
    setDate(now.toLocaleDateString('en-GB',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  }
  tick()
  const id = setInterval(tick, 1000)
  onCleanup(() => clearInterval(id))

  return (
    <div id="clock">
      <div id="time">{time()}</div>
      <div id="date">{date()}</div>
    </div>
  )
}

render(App, document.getElementById('root')!)
