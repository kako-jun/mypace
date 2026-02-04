import { useState } from 'react'
import { Icon, Button } from '../ui'
import { WordCard } from './WordCollectCelebration'
import { useSynthesis, type SynthesisResult } from '../../hooks/wordrot'
import type { UserWordrotWord, WordrotWord } from '../../lib/api'
import '../../styles/components/synthesis-panel.css'

interface SynthesisPanelProps {
  inventory: UserWordrotWord[]
  onSynthesisComplete?: (result: SynthesisResult) => void
}

export function SynthesisPanel({ inventory, onSynthesisComplete }: SynthesisPanelProps) {
  const {
    slotA,
    slotB,
    slotC,
    setSlotA,
    setSlotB,
    setSlotC,
    clearSlots,
    synthesize,
    isSynthesizing,
    error,
    lastResult,
    clearResult,
    canSynthesize,
  } = useSynthesis()

  const [activeSlot, setActiveSlot] = useState<'A' | 'B' | 'C' | null>(null)

  // Get word object from text
  const getWordByText = (text: string | null): WordrotWord | null => {
    if (!text) return null
    const item = inventory.find((w) => w.word.text === text)
    return item?.word || null
  }

  const wordA = getWordByText(slotA)
  const wordB = getWordByText(slotB)
  const wordC = getWordByText(slotC)

  // Handle slot click
  const handleSlotClick = (slot: 'A' | 'B' | 'C') => {
    if (activeSlot === slot) {
      setActiveSlot(null)
    } else {
      setActiveSlot(slot)
    }
  }

  // Handle word selection from inventory
  const handleWordSelect = (word: WordrotWord) => {
    if (!activeSlot) return

    switch (activeSlot) {
      case 'A':
        setSlotA(word.text)
        break
      case 'B':
        setSlotB(word.text)
        break
      case 'C':
        setSlotC(word.text)
        break
    }
    setActiveSlot(null)
  }

  // Handle synthesis
  const handleSynthesize = async () => {
    const result = await synthesize()
    if (result) {
      onSynthesisComplete?.(result)
    }
  }

  // Handle clear
  const handleClear = () => {
    clearSlots()
    clearResult()
  }

  return (
    <div className="synthesis-panel">
      <div className="synthesis-header">
        <h3>
          <Icon name="FlaskConical" size={20} />
          Word Synthesis
        </h3>
        <p className="synthesis-description">Combine words like vectors: A - B + C = ?</p>
      </div>

      {/* Formula display */}
      <div className="synthesis-formula">
        {/* Slot A */}
        <button
          className={`synthesis-slot ${activeSlot === 'A' ? 'active' : ''} ${wordA ? 'filled' : ''}`}
          onClick={() => handleSlotClick('A')}
        >
          {wordA ? (
            <WordCard word={wordA} size="small" />
          ) : (
            <div className="synthesis-slot-empty">
              <Icon name="Plus" size={24} />
              <span>Base</span>
            </div>
          )}
        </button>

        <span className="synthesis-operator">-</span>

        {/* Slot B */}
        <button
          className={`synthesis-slot ${activeSlot === 'B' ? 'active' : ''} ${wordB ? 'filled' : ''}`}
          onClick={() => handleSlotClick('B')}
        >
          {wordB ? (
            <WordCard word={wordB} size="small" />
          ) : (
            <div className="synthesis-slot-empty">
              <Icon name="Minus" size={24} />
              <span>Remove</span>
            </div>
          )}
        </button>

        <span className="synthesis-operator">+</span>

        {/* Slot C */}
        <button
          className={`synthesis-slot ${activeSlot === 'C' ? 'active' : ''} ${wordC ? 'filled' : ''}`}
          onClick={() => handleSlotClick('C')}
        >
          {wordC ? (
            <WordCard word={wordC} size="small" />
          ) : (
            <div className="synthesis-slot-empty">
              <Icon name="Plus" size={24} />
              <span>Add</span>
            </div>
          )}
        </button>

        <span className="synthesis-operator">=</span>

        {/* Result slot */}
        <div className={`synthesis-slot result ${lastResult ? 'filled' : ''}`}>
          {lastResult ? (
            <WordCard word={lastResult.result} size="small" />
          ) : (
            <div className="synthesis-slot-empty">
              <Icon name="HelpCircle" size={24} />
              <span>???</span>
            </div>
          )}
        </div>
      </div>

      {/* Result details */}
      {lastResult && (
        <div className="synthesis-result-details">
          {lastResult.isNewWord && (
            <span className="synthesis-badge new-word">
              <Icon name="Sparkles" size={14} />
              New Word Created!
            </span>
          )}
          {lastResult.isNewSynthesis && !lastResult.isNewWord && (
            <span className="synthesis-badge new-synthesis">
              <Icon name="Star" size={14} />
              New Recipe Discovered!
            </span>
          )}
          <p className="synthesis-formula-text">{lastResult.formula}</p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="synthesis-error">
          <Icon name="AlertCircle" size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="synthesis-actions">
        <Button variant="secondary" onClick={handleClear} disabled={isSynthesizing}>
          Clear
        </Button>
        <Button variant="primary" onClick={handleSynthesize} disabled={!canSynthesize || isSynthesizing}>
          {isSynthesizing ? (
            <>
              <Icon name="Loader" size={16} className="spinning" />
              Synthesizing...
            </>
          ) : (
            <>
              <Icon name="FlaskConical" size={16} />
              Synthesize
            </>
          )}
        </Button>
      </div>

      {/* Word picker when a slot is active */}
      {activeSlot && (
        <div className="synthesis-word-picker">
          <div className="synthesis-word-picker-header">
            <span>Select a word for slot {activeSlot}:</span>
            <button className="synthesis-close-picker" onClick={() => setActiveSlot(null)}>
              <Icon name="X" size={16} />
            </button>
          </div>
          <div className="synthesis-word-grid">
            {inventory.map((item) => (
              <WordCard
                key={item.word.id}
                word={item.word}
                count={item.count}
                onClick={() => handleWordSelect(item.word)}
                selected={item.word.text === slotA || item.word.text === slotB || item.word.text === slotC}
                size="small"
              />
            ))}
            {inventory.length === 0 && (
              <p className="synthesis-empty-inventory">
                No words in inventory. Collect words from posts to synthesize!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Example hint */}
      {!activeSlot && !lastResult && (
        <div className="synthesis-hint">
          <Icon name="Lightbulb" size={14} />
          <span>Example: Fire Mario - Mario + Luigi = Fire Luigi</span>
        </div>
      )}
    </div>
  )
}
