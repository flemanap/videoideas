import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const SUPABASE_URL = 'https://ieahjkraxawvmzhkcwwb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllYWhqa3JheGF3dm16aGN3d2IiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzNjQwNjQwMCwiZXhwIjoxOTUyMDgyNDAwfQ.rWDsCpv3e1VqqV6AV_j2-J串串'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Profile configurations
const PROFILES = [
  {
    id: 'personal',
    name: 'Personal Brand',
    description: 'Personal development, entrepreneurship & lifestyle content',
    color: 'bg-indigo-500',
    borderColor: 'border-indigo-500',
    tabColor: 'bg-indigo-50',
    textColor: 'text-indigo-600'
  },
  {
    id: 'driveswise',
    name: 'DrivesWise',
    description: 'Music distribution & artist promotion',
    color: 'bg-pink-500',
    borderColor: 'border-pink-500',
    tabColor: 'bg-pink-50',
    textColor: 'text-pink-600'
  },
  {
    id: 'profleethire',
    name: 'ProFleetHire',
    description: 'UK Car Rental & HPI Data Checks',
    color: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
    tabColor: 'bg-emerald-50',
    textColor: 'text-emerald-600'
  }
]

function App() {
  const [activeTab, setActiveTab] = useState('personal')
  const [ideas, setIdeas] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastGenerated, setLastGenerated] = useState(null)

  useEffect(() => {
    fetchIdeas()
  }, [])

  async function fetchIdeas() {
    setLoading(true)
    try {
      // Fetch all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')

      // Fetch ideas for each profile
      const ideasData = {}
      for (const profile of profiles) {
        const { data } = await supabase
          .from('generated_ideas')
          .select('*')
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(20)

        ideasData[profile.name] = data || []
      }
      setIdeas(ideasData)

      // Get last generated date
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'last_generation_date')
        .single()

      if (settings) {
        setLastGenerated(settings.value)
      }
    } catch (err) {
      console.error('Error fetching ideas:', err)
    }
    setLoading(false)
  }

  async function regenerateIdeas() {
    setLoading(true)
    try {
      // Call backend to generate new ideas
      await fetch('https://your-backend.onrender.com/api/generate', {
        method: 'POST'
      })

      // Wait a bit and refetch
      setTimeout(() => fetchIdeas(), 2000)
    } catch (err) {
      console.error('Error regenerating:', err)
      setLoading(false)
    }
  }

  async function markComplete(ideaId) {
    try {
      await supabase
        .from('generated_ideas')
        .update({ is_completed: true })
        .eq('id', ideaId)

      fetchIdeas()
    } catch (err) {
      console.error('Error marking complete:', err)
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  function formatDate(dateString) {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function groupIdeasByDate(ideasList) {
    const grouped = {}
    ideasList.forEach(idea => {
      const date = new Date(idea.created_at).toDateString()
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(idea)
    })
    return grouped
  }

  const currentProfile = PROFILES.find(p => p.id === activeTab)
  const currentIdeas = ideas[activeTab] || []
  const groupedIdeas = groupIdeasByDate(currentIdeas)

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ContentFlow</h1>
              <p className="text-sm text-gray-500">Daily Video Idea Generator</p>
            </div>
            <div className="flex items-center gap-4">
              {lastGenerated && (
                <span className="text-sm text-gray-500">
                  Last generated: {formatDate(lastGenerated)}
                </span>
              )}
              <button
                onClick={regenerateIdeas}
                disabled={loading}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate New Ideas'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2 py-2 overflow-x-auto">
            {PROFILES.map(profile => (
              <button
                key={profile.id}
                onClick={() => setActiveTab(profile.id)}
                className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === profile.id
                    ? `${profile.color} text-white shadow-lg`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  {profile.id === 'personal' && '👤'}
                  {profile.id === 'driveswise' && '🎵'}
                  {profile.id === 'profleethire' && '🚗'}
                  {profile.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : currentIdeas.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📹</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No ideas yet</h2>
            <p className="text-gray-500 mb-4">Click "Generate New Ideas" to create content for this profile</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedIdeas).map(([date, dateIdeas]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="sticky top-0 bg-gray-100 py-2 mb-4 z-10">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    {new Date(date).toDateString() === new Date().toDateString()
                      ? 'Today'
                      : new Date(date).toDateString() === new Date(Date.now() - 86400000).toDateString()
                      ? 'Yesterday'
                      : formatDate(date)}
                  </h3>
                </div>

                {/* Ideas Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
                  {dateIdeas.map(idea => (
                    <div
                      key={idea.id}
                      className={`bg-white rounded-xl shadow-sm border-2 ${currentProfile.borderColor} overflow-hidden hover:shadow-md transition-shadow`}
                    >
                      <div className="p-6">
                        {/* Title */}
                        <div className="flex items-start justify-between mb-4">
                          <h3 className="text-xl font-bold text-gray-900 flex-1">
                            {idea.title}
                          </h3>
                          {idea.is_completed && (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                              ✅ Completed
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Description (works for all platforms)
                          </h4>
                          <p className="text-gray-700 leading-relaxed">
                            {idea.description}
                          </p>
                        </div>

                        {/* Script Hook */}
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            🎬 5-Second Hook (Script)
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-800 border-l-4 border-yellow-400">
                            {idea.script_hook}
                          </div>
                        </div>

                        {/* Full Script */}
                        {idea.script_full && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              📝 Full Script (Under 60s)
                            </h4>
                            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                              {idea.script_full}
                            </div>
                          </div>
                        )}

                        {/* Hashtags */}
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Hashtags
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {idea.hashtags?.map((tag, i) => (
                              <span
                                key={i}
                                className={`px-3 py-1 rounded-full text-sm font-medium ${currentProfile.tabColor} ${currentProfile.textColor}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Source Topic */}
                        {idea.source_topic && (
                          <div className="text-sm text-gray-500 mb-4">
                            <span className="font-medium">Source:</span> {idea.source_topic}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t">
                          <button
                            onClick={() => copyToClipboard(idea.script_hook || idea.script_full)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                          >
                            📋 Copy Script
                          </button>
                          <button
                            onClick={() => copyToClipboard(idea.hashtags?.join(' '))}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                          >
                            #️⃣ Copy Hashtags
                          </button>
                          <button
                            onClick={() => markComplete(idea.id)}
                            disabled={idea.is_completed}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium disabled:opacity-50"
                          >
                            {idea.is_completed ? '✓ Completed' : '✓ Mark Done'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          ContentFlow Generator • Powered by AI • Updates daily at 6 AM UTC
        </div>
      </footer>
    </div>
  )
}

export default App
