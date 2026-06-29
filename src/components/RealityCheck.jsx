import { useState } from 'react'

export default function RealityCheck({ questions = [], onComplete }) {
  const [answers, setAnswers] = useState([])

  const answer = (id, value) => {
    const next = [...answers.filter((item) => item.id !== id), { id, answer: value }]
    setAnswers(next)
    if (next.length >= questions.length) onComplete(next)
  }

  if (!questions.length) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-void/80 px-5 backdrop-blur-md">
      <div className="w-[90%] max-w-[480px] rounded-2xl border border-white/10 bg-[rgba(15,10,30,0.95)] p-6 shadow-critical animate-scale-in md:p-8">
        <h2 className="font-orbitron text-2xl font-black text-critical">REALITY CHECK</h2>
        <p className="mt-2 text-sm text-slate-400">Answer fast. These change the plan.</p>
        <div className="mt-6 space-y-5">
          {questions.map((question) => {
            const selected = answers.find((item) => item.id === question.id)
            return (
              <div key={question.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-lg font-semibold text-white">{question.question}</p>
                <p className="mt-2 text-xs text-slate-400">Yes -&gt; {question.impact_if_yes}</p>
                <p className="mt-1 text-xs text-slate-400">No -&gt; {question.impact_if_no}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => answer(question.id, 'yes')} className={`rounded-lg border p-3 font-mono text-sm text-done ${selected?.answer === 'yes' ? 'bg-done/15' : 'border-done/40'}`}>YES</button>
                  <button onClick={() => answer(question.id, 'no')} className={`rounded-lg border p-3 font-mono text-sm text-critical ${selected?.answer === 'no' ? 'bg-critical/15' : 'border-critical/40'}`}>NO</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

