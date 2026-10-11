const axios = require('axios')

const headers = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
  'Content-Type': 'application/json',
  'x-csrftoken': 'daaaed19c58a2787b0d6a23620be18e1',
  'Cookie': 'csrftoken=daaaed19c58a2787b0d6a23620be18e1; _auth=1'
}

async function parsePinterestId(url) {
  let finalUrl = url
  if (/pin\.it/i.test(url)) {
    const r = await axios.head(url, { maxRedirects: 5 })
    finalUrl = r.request?.res?.responseUrl || r.config?.url
  }
  return finalUrl.match(/\/pin\/(\d+)/)?.[1]
}

function serialize(d1, d2) {
  const a = d1?.data?.v3GetPinQueryv2?.data || {}
  const b = d2?.data?.v3GetPinQueryv2?.data || {}

  const user = {
    fullName: b?.pinner?.fullName || b?.nativeCreator?.fullName || a?.closeupAttribution?.fullName || a?.nativeCreator?.fullName || '(unknown)',
    username: b?.pinner?.username || a?.nativeCreator?.username || a?.pinner?.username || '(unknown)'
  }

  const post = {
    title: b?.title?.trim() || b?.closeupUnifiedDescription?.trim() || b?.description?.trim() || '(no title)',
    description: b?.description?.trim() || b?.closeupUnifiedDescription?.trim() || '',
    likesCount: b?.totalReactionCount || 0,
    commentCount: b?.aggregatedPinData?.commentCount || 0,
    createdAt: b?.createdAt || '(unknown)'
  }

  const v = b?.storyPinData?.pages?.[0]?.blocks?.[0]?.videoDataV2?.videoList720P?.v720P
    || b?.videos?.videoList?.v720P

  const content = {
    images: Object.keys(a).filter(k => k.startsWith('images_')).map(k => ({ ...a[k], name: k.replace('images_', '') })),
    videos: v ? [v] : []
  }

  return { user, post, content }
}

async function pinterest(pinurl) {
  try {
    const pinId = await parsePinterestId(pinurl)
    if (!pinId) throw new Error('ID Pinterest tidak ditemukan, pastikan URL valid!')

    const [r1, r2] = await Promise.all([
      axios.post('https://id.pinterest.com/_/graphql/', {
        queryHash: '5444a9d6e1f023c6785830bbadc6f60fe2bb7a8775b86f77905d400cfb06991b',
        variables: { pinId, isAuth: true, isDesktop: false, isUnauth: false, shouldPrefetchStoryPinFragment: false, shouldSkipImageViewerOnPageQuery: true }
      }, { headers }),
      axios.post('https://id.pinterest.com/_/graphql/', {
        queryHash: 'a03317b3c9329575ec06fe3aeff2a3f194dae93a4eaaf4d16eab671fd2efd198',
        variables: { pinId, isAuth: true, isDesktop: false, isUnauth: false, shouldDefer: false, shouldFetchAIInsight: false, shouldShowSeoDrawerOption: false }
      }, { headers })
    ])

    return serialize(r1.data, r2.data)
  } catch (error) {
    throw error
  }
}

// Mengekspor fungsi agar bisa dipakai di file bot utama
module.exports = { pinterest }