import { Icon, Button } from '../ui'
import { WordCard } from './WordCollectCelebration'
import type { SynthesisResult, UseSynthesisReturn } from '../../hooks/wordrot'
import type { UserWordrotWord, WordrotWord } from '../../lib/api'
import { retryWordImage } from '../../lib/api'
import '../../styles/components/synthesis-panel.css'

interface SynthesisPanelProps {
  inventory: UserWordrotWord[]
  synthesis: UseSynthesisReturn
  activeSlot: 'A' | 'B' | 'C'
  onSlotTap: (slot: 'A' | 'B' | 'C') => void
  onClear?: () => void
  onSynthesisComplete?: (result: SynthesisResult) => void
}

export function SynthesisPanel({
  inventory,
  synthesis,
  activeSlot,
  onSlotTap,
  onClear,
  onSynthesisComplete,
}: SynthesisPanelProps) {
  const { slotA, slotB, slotC, clearSlots, synthesize, isSynthesizing, error, lastResult, clearResult, canSynthesize } =
    synthesis

  // Get word object from text
  const getWordByText = (text: string | null): WordrotWord | null => {
    if (!text) return null
    // Check inventory first
    const item = inventory.find((w) => w.word.text === text)
    if (item) return item.word
    // Check if it's the result word
    if (lastResult?.result.text === text) return lastResult.result
    return null
  }

  const wordA = getWordByText(slotA)
  const wordB = getWordByText(slotB)
  const wordC = getWordByText(slotC)

  // Handle slot tap: if filled, clear it; always set as active
  const handleSlotTap = (slot: 'A' | 'B' | 'C') => {
    onSlotTap(slot)
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
    onClear?.()
  }

  const renderSlot = (slot: 'A' | 'B' | 'C', word: WordrotWord | null) => (
    <button
      className={`synthesis-slot ${activeSlot === slot ? 'active' : ''} ${word ? 'filled' : ''}`}
      onClick={() => handleSlotTap(slot)}
    >
      {word ? <WordCard word={word} size="small" /> : <span className="synthesis-slot-placeholder">?</span>}
    </button>
  )

  return (
    <div className="synthesis-bar">
      {/* Formula row */}
      <div className="synthesis-formula">
        {renderSlot('A', wordA)}
        <span className="synthesis-operator">-</span>
        {renderSlot('B', wordB)}
        <span className="synthesis-operator">+</span>
        {renderSlot('C', wordC)}
        <span className="synthesis-operator">=</span>

        {/* Result slot */}
        <div className={`synthesis-slot result ${lastResult ? 'filled born' : ''}`}>
          {lastResult ? (
            <WordCard word={lastResult.result} size="small" onRetryImage={retryWordImage} />
          ) : (
            <span className="synthesis-slot-placeholder">?</span>
          )}
        </div>
      </div>

      {/* Result badges */}
      {lastResult && (
        <div className="synthesis-result-details">
          {lastResult.isNewWord && (
            <span className="synthesis-badge new-word">
              <Icon name="Sparkles" size={14} />
              New Wordrot!
            </span>
          )}
          {lastResult.isNewSynthesis && !lastResult.isNewWord && (
            <span className="synthesis-badge new-synthesis">
              <Icon name="Star" size={14} />
              New Recipe!
            </span>
          )}
          <span className="synthesis-formula-text">{lastResult.formula}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="synthesis-error">
          <Icon name="AlertCircle" size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="synthesis-actions">
        {lastResult ? (
          <Button variant="primary" size="sm" onClick={handleClear}>
            <Icon name="FlaskConical" size={14} />
            New Synthesis
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={handleClear} disabled={isSynthesizing}>
              Clear
            </Button>
            <Button variant="primary" size="sm" onClick={handleSynthesize} disabled={!canSynthesize || isSynthesizing}>
              {isSynthesizing ? (
                <>
                  <Icon name="Loader" size={14} className="spinning" />
                  Synthesizing...
                </>
              ) : (
                <>
                  <Icon name="FlaskConical" size={14} />
                  Synthesize!
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
