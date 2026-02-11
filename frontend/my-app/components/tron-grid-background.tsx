'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'

type Direction = 'up' | 'down' | 'left' | 'right'

interface Point {
  x: number
  y: number
}

interface Entity {
  head: Point
  trail: Point[]
  directions: Direction[]  // Track direction at each trail point
  direction: Direction
  isDestroyed: boolean
  caughtCount: number
}

const GRID = 40
const SPEED = 2
const TRAIL_LENGTH = 30
const BODY_WIDTH = 6
const HEAD_LENGTH = 24

export function TronGridBackground() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const isDark = resolvedTheme === 'dark'
  const [dims, setDims] = React.useState({ w: 1200, h: 800 })
  const [showSuccess, setShowSuccess] = React.useState(false)
  
  const blueRef = React.useRef<Entity>({
    head: { x: 100, y: 200 },
    trail: [],
    directions: [],
    direction: 'right',
    isDestroyed: false,
    caughtCount: 0
  })

  const orangeRef = React.useRef<Entity>({
    head: { x: 600, y: 400 },
    trail: [],
    directions: [],
    direction: 'left',
    isDestroyed: false,
    caughtCount: 0
  })
  
  const [, forceUpdate] = React.useState(0)

  React.useEffect(() => {
    setMounted(true)
    const update = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setDims({ w, h })
      
      // Initialize on first load
      if (blueRef.current.head.x === 100 && blueRef.current.trail.length === 0) {
        const bx = Math.floor(w * 0.2 / GRID) * GRID
        const by = Math.floor(h * 0.5 / GRID) * GRID
        blueRef.current.head = { x: bx, y: by }
        blueRef.current.trail = Array(TRAIL_LENGTH).fill({ x: bx, y: by })
        blueRef.current.directions = Array(TRAIL_LENGTH).fill('right')
      }

      if (orangeRef.current.head.x === 600 && orangeRef.current.trail.length === 0) {
        const ox = Math.floor(w * 0.8 / GRID) * GRID
        const oy = Math.floor(h * 0.5 / GRID) * GRID
        orangeRef.current.head = { x: ox, y: oy }
        orangeRef.current.trail = Array(TRAIL_LENGTH).fill({ x: ox, y: oy })
        orangeRef.current.directions = Array(TRAIL_LENGTH).fill('left')
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Get new direction for chaser (blue)
  // FORBIDS BACKWARD MOTION - entities can only go forward, left, or right
  const getChaseDirection = (current: Direction, myX: number, myY: number, targetX: number, targetY: number): Direction => {
    const opps: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' }
    // Filter out backward direction (opposite of current) - can only go forward, left, or right
    const available = ['up', 'down', 'left', 'right'].filter(d => d !== opps[current]) as Direction[]
    
    const scores = available.map(dir => {
      let nx = myX, ny = myY
      if (dir === 'right') nx += GRID
      if (dir === 'left') nx -= GRID
      if (dir === 'down') ny += GRID
      if (dir === 'up') ny -= GRID
      
      const dist = Math.abs(nx - targetX) + Math.abs(ny - targetY)
      return { dir, dist }
    })
    
    scores.sort((a, b) => a.dist - b.dist)
    return Math.random() < 0.8 ? scores[0].dir : (scores[1]?.dir || scores[0].dir)
  }

  // Get new direction for fleeing (orange)
  // FORBIDS BACKWARD MOTION - entities can only go forward, left, or right
  const getFleeDirection = (current: Direction, myX: number, myY: number, threatX: number, threatY: number): Direction => {
    const opps: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' }
    // Filter out backward direction (opposite of current) - can only go forward, left, or right
    const available = ['up', 'down', 'left', 'right'].filter(d => d !== opps[current]) as Direction[]
    
    const scores = available.map(dir => {
      let nx = myX, ny = myY
      if (dir === 'right') nx += GRID
      if (dir === 'left') nx -= GRID
      if (dir === 'down') ny += GRID
      if (dir === 'up') ny -= GRID
      
      const dist = Math.abs(nx - threatX) + Math.abs(ny - threatY)
      return { dir, dist }
    })
    
    scores.sort((a, b) => b.dist - a.dist)
    return Math.random() < 0.8 ? scores[0].dir : (scores[1]?.dir || scores[0].dir)
  }

  // Helper to get a valid direction that doesn't go off-screen
  // FORBIDS BACKWARD MOTION - entities can only go forward, left, or right
  const getValidDirection = (current: Direction, preferred: Direction, x: number, y: number, maxX: number, maxY: number): Direction => {
    const opps: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' }
    const allDirs: Direction[] = ['up', 'down', 'left', 'right']
    
    // Check if preferred direction is valid (not off-screen and not backward)
    let isValid = true
    if (preferred === 'right' && x >= maxX) isValid = false
    if (preferred === 'left' && x <= 0) isValid = false
    if (preferred === 'down' && y >= maxY) isValid = false
    if (preferred === 'up' && y <= 0) isValid = false
    if (preferred === opps[current]) isValid = false // NEVER go backward
    
    if (isValid) return preferred
    
    // Find valid alternatives (excluding backward direction)
    const validDirs = allDirs.filter(dir => {
      if (dir === 'right' && x >= maxX) return false
      if (dir === 'left' && x <= 0) return false
      if (dir === 'down' && y >= maxY) return false
      if (dir === 'up' && y <= 0) return false
      return dir !== opps[current] // NEVER go backward from current direction
    })
    
    return validDirs.length > 0 ? validDirs[Math.floor(Math.random() * validDirs.length)] : preferred
  }

  React.useEffect(() => {
    if (!mounted) return
    
    let animationId: number
    let lastTime = performance.now()
    
    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTime

      if (deltaTime >= 16) {
        lastTime = currentTime
        
        // Update Blue - smooth movement along grid lines
        if (!blueRef.current.isDestroyed) {
          const blue = blueRef.current
          let { head, trail, directions, direction } = blue
          
          let x = head.x
          let y = head.y
          let wrapped = false
          
          // Move smoothly in cardinal direction
          switch (direction) {
            case 'right': x += SPEED; break
            case 'left': x -= SPEED; break
            case 'down': y += SPEED; break
            case 'up': y -= SPEED; break
          }
          
          // Snap to nearest grid intersection when close
          const nearestGridX = Math.round(x / GRID) * GRID
          const nearestGridY = Math.round(y / GRID) * GRID
          const distToGridX = Math.abs(x - nearestGridX)
          const distToGridY = Math.abs(y - nearestGridY)
          
          // Check if we hit a grid intersection
          if (distToGridX < SPEED && distToGridY < SPEED) {
            x = nearestGridX
            y = nearestGridY
            
            // Wrap around
            const maxX = Math.floor((dims.w - 1) / GRID) * GRID
            const maxY = Math.floor((dims.h - 1) / GRID) * GRID
            
            if (x > maxX) { x = 0; wrapped = true; }
            if (x < 0) { x = maxX; wrapped = true; }
            if (y > maxY) { y = 0; wrapped = true; }
            if (y < 0) { y = maxY; wrapped = true; }
            
            // Decide whether to turn
            const atEdge = x === 0 || x === maxX || y === 0 || y === maxY
            if (atEdge || Math.random() < 0.12) {
              const newDir = getChaseDirection(direction, x, y, orangeRef.current.head.x, orangeRef.current.head.y)
              if (newDir !== direction) {
                direction = newDir
              }
            }
          }
          
          // Update trail - reset trail on wrap to avoid cross-screen lines
          blueRef.current = {
            ...blue,
            head: { x, y },
            trail: wrapped ? Array(TRAIL_LENGTH).fill({ x, y }) : [head, ...trail.slice(0, TRAIL_LENGTH - 1)],
            directions: wrapped ? Array(TRAIL_LENGTH).fill(direction) : [direction, ...directions.slice(0, TRAIL_LENGTH - 1)],
            direction
          }
        }

        // Update Orange - EXACT SAME CODE AS BLUE, just uses getFleeDirection
        if (!orangeRef.current.isDestroyed) {
          const orange = orangeRef.current
          let { head, trail, directions, direction } = orange
          
          let x = head.x
          let y = head.y
          let wrapped = false
          
          // Move smoothly in cardinal direction - SAME AS BLUE
          switch (direction) {
            case 'right': x += SPEED; break
            case 'left': x -= SPEED; break
            case 'down': y += SPEED; break
            case 'up': y -= SPEED; break
          }
          
          // Snap to nearest grid intersection when close - SAME AS BLUE
          const nearestGridX = Math.round(x / GRID) * GRID
          const nearestGridY = Math.round(y / GRID) * GRID
          const distToGridX = Math.abs(x - nearestGridX)
          const distToGridY = Math.abs(y - nearestGridY)
          
          // Check if we hit a grid intersection - SAME AS BLUE
          if (distToGridX < SPEED && distToGridY < SPEED) {
            x = nearestGridX
            y = nearestGridY
            
            // Wrap around - SAME AS BLUE
            const maxX = Math.floor((dims.w - 1) / GRID) * GRID
            const maxY = Math.floor((dims.h - 1) / GRID) * GRID
            
            if (x > maxX) { x = 0; wrapped = true; }
            if (x < 0) { x = maxX; wrapped = true; }
            if (y > maxY) { y = 0; wrapped = true; }
            if (y < 0) { y = maxY; wrapped = true; }
            
            // Decide whether to turn - flee from blue, but prioritize escaping edges
            const atEdge = x === 0 || x === maxX || y === 0 || y === maxY
            const atCorner = (x === 0 || x === maxX) && (y === 0 || y === maxY)
            
            if (atCorner) {
              // Must turn away from corner - pick direction away from both edges
              if (x === 0 && y === 0) direction = Math.random() < 0.5 ? 'right' : 'down'
              else if (x === maxX && y === 0) direction = Math.random() < 0.5 ? 'left' : 'down'
              else if (x === 0 && y === maxY) direction = Math.random() < 0.5 ? 'right' : 'up'
              else if (x === maxX && y === maxY) direction = Math.random() < 0.5 ? 'left' : 'up'
            } else if (atEdge) {
              // At edge but not corner - 70% chance to flee, 30% chance to continue along edge
              if (Math.random() < 0.7) {
                const newDir = getFleeDirection(direction, x, y, blueRef.current.head.x, blueRef.current.head.y)
                // But don't choose a direction that goes off-screen or backward
                const validDir = getValidDirection(direction, newDir, x, y, maxX, maxY)
                direction = validDir
              }
              // 30% chance: keep going along the edge
            } else if (Math.random() < 0.12) {
              // Normal flee behavior when not at edge
              const newDir = getFleeDirection(direction, x, y, blueRef.current.head.x, blueRef.current.head.y)
              if (newDir !== direction) {
                direction = newDir
              }
            }
          }
          
          // Update trail - reset trail on wrap to avoid cross-screen lines
          orangeRef.current = {
            ...orange,
            head: { x, y },
            trail: wrapped ? Array(TRAIL_LENGTH).fill({ x, y }) : [head, ...trail.slice(0, TRAIL_LENGTH - 1)],
            directions: wrapped ? Array(TRAIL_LENGTH).fill(direction) : [direction, ...directions.slice(0, TRAIL_LENGTH - 1)],
            direction
          }
        }
        
        // Check collision
        const blue = blueRef.current
        const orange = orangeRef.current
        
        if (!blue.isDestroyed && !orange.isDestroyed) {
          const dx = Math.abs(blue.head.x - orange.head.x)
          const dy = Math.abs(blue.head.y - orange.head.y)
          
          if (dx < GRID / 2 && dy < GRID / 2) {
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 1500)
            
            const newCaughtCount = blue.caughtCount + 1
            blueRef.current = { ...blue, caughtCount: newCaughtCount }
            orangeRef.current = { ...orange, isDestroyed: true, trail: [], directions: [] }
            
            setTimeout(() => {
              const maxX = Math.floor((dims.w - 1) / GRID) * GRID
              const maxY = Math.floor((dims.h - 1) / GRID) * GRID
              const newX = blueRef.current.head.x > dims.w / 2 ? GRID * 3 : maxX - GRID * 3
              const newY = blueRef.current.head.y > dims.h / 2 ? GRID * 3 : maxY - GRID * 3

              orangeRef.current = {
                head: { x: newX, y: newY },
                trail: Array(TRAIL_LENGTH).fill({ x: newX, y: newY }),
                directions: Array(TRAIL_LENGTH).fill('left'),
                direction: 'left',
                isDestroyed: false,
                caughtCount: orange.caughtCount
              }
            }, 1000)
          }
        }
        
        forceUpdate(n => n + 1)
      }
      
      animationId = requestAnimationFrame(gameLoop)
    }
    
    animationId = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(animationId)
  }, [mounted, dims])

  if (!mounted) return <div className="fixed inset-0 tron-grid opacity-40 -z-10" />

  const cols = Math.ceil(dims.w / GRID)
  const rows = Math.ceil(dims.h / GRID)
  const blue = blueRef.current
  const orange = orangeRef.current
  
  const getRotation = (dir: Direction): number => {
    switch (dir) {
      case 'right': return 0
      case 'down': return 90
      case 'left': return 180
      case 'up': return -90
      default: return 0
    }
  }

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      {/* Grid Lines */}
      <svg className="absolute inset-0 w-full h-full opacity-25">
        {Array.from({ length: cols + 1 }).map((_, i) => (
          <line 
            key={`v-${i}`} 
            x1={i * GRID} 
            y1={0} 
            x2={i * GRID} 
            y2={dims.h} 
            stroke="currentColor" 
            strokeWidth="1" 
            className="text-muted-foreground" 
          />
        ))}
        {Array.from({ length: rows + 1 }).map((_, i) => (
          <line 
            key={`h-${i}`} 
            x1={0} 
            y1={i * GRID} 
            x2={dims.w} 
            y2={i * GRID} 
            stroke="currentColor" 
            strokeWidth="1" 
            className="text-muted-foreground" 
          />
        ))}
      </svg>
      
      {/* Success message */}
      {showSuccess && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div 
            className="text-5xl font-bold animate-pulse" 
            style={{ 
              color: '#00D9FF', 
              textShadow: '0 0 20px #00D9FF, 0 0 40px #00D9FF, 0 0 60px #00D9FF' 
            }}
          >
            CAUGHT!
          </div>
        </div>
      )}
      
      {/* Blue Entity - Smooth SVG Path */}
      {!blue.isDestroyed && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
          {/* Blue Body Path - smooth continuous line */}
          <defs>
            <linearGradient id="blueGradient" gradientUnits="userSpaceOnUse">
              {blue.trail.map((point, i) => {
                const progress = i / (blue.trail.length - 1)
                const opacity = Math.max(0.2, 1 - progress)
                return (
                  <stop
                    key={`bg-${i}`}
                    offset={`${progress * 100}%`}
                    stopColor="#00D9FF"
                    stopOpacity={opacity}
                  />
                )
              })}
            </linearGradient>
          </defs>
          
          {/* Body stroke */}
          <polyline
            points={blue.trail.map((p, i) => {
              // Add slight taper effect by adjusting points
              return `${p.x},${p.y}`
            }).join(' ')}
            fill="none"
            stroke="#00D9FF"
            strokeWidth={BODY_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(0, 217, 255, 0.8))',
              opacity: 0.7
            }}
          />
          
          {/* Blue Head */}
          <g transform={`translate(${blue.head.x}, ${blue.head.y}) rotate(${getRotation(blue.direction)})`}>
            <rect
              x={-HEAD_LENGTH / 2}
              y={-(BODY_WIDTH + 2) / 2}
              width={HEAD_LENGTH}
              height={BODY_WIDTH + 2}
              rx={(BODY_WIDTH + 2) / 2}
              fill="#00D9FF"
              style={{
                filter: 'drop-shadow(0 0 15px rgba(0, 217, 255, 1))'
              }}
            />
          </g>
        </svg>
      )}

      {/* Orange Entity - Smooth SVG Path */}
      {!orange.isDestroyed && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
          {/* Orange Body Path - smooth continuous line */}
          <polyline
            points={orange.trail.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#FF6B35"
            strokeWidth={BODY_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(255, 107, 53, 0.8))',
              opacity: 0.7
            }}
          />
          
          {/* Orange Head */}
          <g transform={`translate(${orange.head.x}, ${orange.head.y}) rotate(${getRotation(orange.direction)})`}>
            <rect
              x={-HEAD_LENGTH / 2}
              y={-(BODY_WIDTH + 2) / 2}
              width={HEAD_LENGTH}
              height={BODY_WIDTH + 2}
              rx={(BODY_WIDTH + 2) / 2}
              fill="#FF6B35"
              style={{
                filter: 'drop-shadow(0 0 15px rgba(255, 107, 53, 1))'
              }}
            />
          </g>
        </svg>
      )}
      
      {/* Score Display */}
      <div 
        className="absolute top-5 right-5 font-mono text-sm z-20"
        style={{
          color: isDark ? '#00D9FF' : '#FF6B35',
          textShadow: `0 0 10px ${isDark ? 'rgba(0, 217, 255, 0.8)' : 'rgba(255, 107, 53, 0.8)'}`,
        }}
      >
        SCORE: {blue.caughtCount}
      </div>
    </div>
  )
}
