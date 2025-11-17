import React from 'react'
import { ResizablePanel } from './ResizablePanel'

interface StudioLayoutProps {
  leftSidebar: React.ReactNode
  centerCanvas: React.ReactNode
  rightPanel: React.ReactNode
  bottomPanel: React.ReactNode
  topBar: React.ReactNode
}

export function StudioLayout({
  leftSidebar,
  centerCanvas,
  rightPanel,
  bottomPanel,
  topBar,
}: StudioLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="border-b border-border bg-card flex-shrink-0">
        {topBar}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Resizable */}
        <ResizablePanel
          direction="horizontal"
          defaultSize={256}
          minSize={150}
          maxSize={500}
          storageKey="rl-studio-left-sidebar-width"
        >
          <div className="h-full border-r border-border bg-card overflow-y-auto">
            {leftSidebar}
          </div>
        </ResizablePanel>

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-auto bg-muted/20 p-4 min-h-0">
            {centerCanvas}
          </div>
          
          {/* Bottom Panel - Resizable */}
          <ResizablePanel
            direction="vertical"
            defaultSize={192}
            minSize={100}
            maxSize={600}
            storageKey="rl-studio-bottom-panel-height"
            resizeFrom="start"
          >
            <div className="h-full border-t border-border bg-card overflow-hidden">
              {bottomPanel}
            </div>
          </ResizablePanel>
        </div>

        {/* Right Panel - Resizable */}
        <ResizablePanel
          direction="horizontal"
          defaultSize={320}
          minSize={200}
          maxSize={600}
          storageKey="rl-studio-right-panel-width"
          resizeFrom="start"
        >
          <div className="h-full border-l border-border bg-card overflow-y-auto">
            {rightPanel}
          </div>
        </ResizablePanel>
      </div>
    </div>
  )
}

