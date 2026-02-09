import { useEffect, useState } from 'react'
import { Icon } from '../ui'
import { WordCard } from './WordCollectCelebration'
import type { WordrotWord } from '../../lib/api'
import { fetchWordrotRecipes, convertToItalian } from '../../lib/api'
import '../../styles/components/word-synthesis-celebration.css'

interface WordSynthesisCelebrationProps {
  word: WordrotWord
  isNewWord: boolean
  isNewRecipe: boolean
  isVisible: boolean
  onClose: () => void
}

interface Recipe {
  word_a: string
  word_b: string
  word_c: string
  discovered_at: number
}

export function WordSynthesisCelebration({
  word,
  isNewWord,
  isNewRecipe,
  isVisible,
  onClose,
}: WordSynthesisCelebrationProps) {
  const [showShareHint] = useState(false)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loadingRecipes, setLoadingRecipes] = useState(false)
  const [italianCache, setItalianCache] = useState<Map<string, { a: string; b: string; c: string }>>(new Map())
  const [playingRecipeIndex, setPlayingRecipeIndex] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Load recipes when visible
  useEffect(() => {
    if (isVisible && word.text) {
      setLoadingRecipes(true)
      fetchWordrotRecipes(word.text)
        .then((data) => setRecipes(data.recipes))
        .catch((e) => console.error('Failed to load recipes:', e))
        .finally(() => setLoadingRecipes(false))
    }
  }, [isVisible, word.text])

  // Speak Italian with caching, loading state, and error handling
  const speakItalian = async (wordA: string, wordB: string, wordC: string, recipeIndex: number) => {
    // Check if speech synthesis is supported
    if (!('speechSynthesis' in window)) {
      setErrorMessage('Your browser does not support voice playback')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    // Stop any currently playing speech
    window.speechSynthesis.cancel()

    setPlayingRecipeIndex(recipeIndex)
    setErrorMessage(null)

    try {
      // Check cache first
      const cacheKey = `${wordA}|${wordB}|${wordC}`
      let italian = italianCache.get(cacheKey)

      if (!italian) {
        // Convert to Italian
        const result = await convertToItalian(wordA, wordB, wordC)
        if (!result) {
          setErrorMessage('Failed to convert to Italian')
          setTimeout(() => setErrorMessage(null), 3000)
          setPlayingRecipeIndex(null)
          return
        }
        italian = result
        // Cache the result
        setItalianCache((prev) => new Map(prev).set(cacheKey, italian!))
      }

      // Use Web Speech API
      const phrase = `${italian.a} ${italian.b} ${italian.c}`
      const utterance = new SpeechSynthesisUtterance(phrase)
      utterance.lang = 'it-IT'
      utterance.rate = 0.9
      utterance.pitch = 1.0

      // Clear playing state when done
      utterance.onend = () => setPlayingRecipeIndex(null)
      utterance.onerror = () => {
        setErrorMessage('Voice playback failed')
        setTimeout(() => setErrorMessage(null), 3000)
        setPlayingRecipeIndex(null)
      }

      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.error('Failed to speak Italian:', e)
      setErrorMessage('Voice playback failed')
      setTimeout(() => setErrorMessage(null), 3000)
      setPlayingRecipeIndex(null)
    }
  }

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className={`word-synthesis-backdrop ${isVisible ? 'visible' : ''}`} onClick={handleBackdropClick}>
      {/* Sparkle particles */}
      <div className="word-synthesis-sparkles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="word-synthesis-sparkle"
            style={
              {
                '--delay': `${Math.random() * 2}s`,
                '--x': `${Math.random() * 100}%`,
                '--y': `${Math.random() * 100}%`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className={`word-synthesis-content ${isVisible ? 'visible' : ''}`}>
        {/* Icon with glow effect */}
        <div className="word-synthesis-icon-wrapper">
          <Icon name="FlaskConical" size={48} />
        </div>

        {/* Title */}
        <h2 className="word-synthesis-title">
          {isNewWord ? 'New Wordrot!' : isNewRecipe ? 'New Recipe!' : 'Synthesis Complete!'}
        </h2>

        {/* Word card - large */}
        <div className="word-synthesis-card">
          <WordCard word={word} size="large" source="synthesis" />
        </div>

        {/* Badges */}
        {(isNewWord || isNewRecipe) && (
          <div className="word-synthesis-badges">
            {isNewWord && (
              <span className="word-synthesis-badge new-word">
                <Icon name="Sparkles" size={16} />
                NEW!
              </span>
            )}
            {isNewRecipe && !isNewWord && (
              <span className="word-synthesis-badge new-recipe">
                <Icon name="Star" size={16} />
                New Recipe!
              </span>
            )}
          </div>
        )}

        {/* Synthesis Recipes */}
        {recipes.length > 0 && (
          <div className="word-synthesis-recipes">
            <h3 className="word-synthesis-recipes-title">Synthesis Recipes</h3>
            {errorMessage && (
              <div className="word-synthesis-error">
                <Icon name="AlertCircle" size={14} />
                {errorMessage}
              </div>
            )}
            <div className="word-synthesis-recipes-list">
              {loadingRecipes ? (
                <p className="word-synthesis-recipes-loading">Loading...</p>
              ) : (
                recipes.map((recipe, i) => (
                  <div key={i} className="word-synthesis-recipe-item">
                    <span className="word-synthesis-recipe-formula">
                      {recipe.word_a} - {recipe.word_b} + {recipe.word_c}
                    </span>
                    <button
                      type="button"
                      className={`word-synthesis-recipe-speaker ${playingRecipeIndex === i ? 'playing' : ''}`}
                      onClick={() => speakItalian(recipe.word_a, recipe.word_b, recipe.word_c, i)}
                      disabled={playingRecipeIndex !== null}
                      aria-label="Speak in Italian"
                    >
                      {playingRecipeIndex === i ? (
                        <Icon name="Loader2" size={16} className="animate-spin" />
                      ) : (
                        <Icon name="Volume2" size={16} />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Share hint */}
        {showShareHint && (
          <p className="word-synthesis-share-hint">
            <Icon name="Share2" size={14} />
            Share your discovery!
          </p>
        )}

        {/* Tap to dismiss hint */}
        <p className="word-synthesis-hint">Tap anywhere to continue</p>
      </div>
    </div>
  )
}
