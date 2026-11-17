/**
 * Starter template: the questions of the Aumera website-revamp brief (Nov 2026),
 * converted by script. The "What we noted" pre-fills were dropped: they belong
 * on a client's brief, not on a reusable template.
 */
import type { Secao } from "./schema";

export const MODELO_REVAMP_DE_SITE: { nome: string; descricao: string; secoes: Secao[] } = {
  nome: "Website revamp",
  descricao: "Brand, inspiration, products, photos, shop details and social presence for a website rebuild.",
  secoes: [
    {
      "id": "understood",
      "t": "What we understood",
      "d": "A quick check that we have the essence of Aumèra right. Tap one, and add a note wherever you’d like to correct us.",
      "q": [
        {
          "id": "essence",
          "type": "confirm",
          "q": "Aumèra is an emotional-luxury fragrance brand. Perfume worn to remember, not to impress."
        },
        {
          "id": "two_worlds",
          "type": "confirm",
          "q": "There are two collections: THEON is for you, and Soul Sutras is for your loved ones."
        },
        {
          "id": "made",
          "type": "confirm",
          "q": "Every perfume is handcrafted in Kannauj in small batches: crystal-infused, plant-based and alcohol-free."
        },
        {
          "id": "size",
          "type": "confirm",
          "q": "Perfumes come in 10ml, travel-friendly sizes."
        },
        {
          "id": "cities",
          "type": "confirm",
          "q": "Your key customers are in Mumbai, Bangalore, Ahmedabad and other metro cities."
        },
        {
          "id": "gifting",
          "type": "confirm",
          "q": "Gifting matters a lot, and you want a soulful, customisable gift range."
        },
        {
          "id": "range",
          "type": "confirm",
          "q": "The range will grow beyond perfume: candles, a 5-minute journal, premium flowers and an easel with a card."
        },
        {
          "id": "builder",
          "type": "confirm",
          "q": "Customers should be able to build their own gift box by picking their own products, for example any 3."
        },
        {
          "id": "online",
          "type": "confirm",
          "q": "Beyond the website, Aumèra will grow on Instagram, Facebook, LinkedIn and Google, and later on Amazon and Nykaa."
        }
      ]
    },
    {
      "id": "brand",
      "t": "Look and feel",
      "d": "How Aumèra should look and sound on the new website.",
      "q": [
        {
          "id": "name_spelling",
          "type": "one",
          "q": "How should the name be written across the website?",
          "opts": [
            "Aumèra",
            "Aumera",
            "Aumēra"
          ]
        },
        {
          "id": "tagline",
          "type": "one",
          "q": "Which line should lead the homepage?",
          "opts": [
            "Awaken the infinite within",
            "Aumèra stays with you",
            "Not worn to impress. Worn to remember."
          ]
        },
        {
          "id": "colours",
          "type": "one",
          "q": "We plan to build the new look around the rose gold of your logo. Does that feel right?",
          "opts": [
            "Yes, love it",
            "Yes, with another colour too",
            "Prefer something different"
          ]
        },
        {
          "id": "feel",
          "type": "many",
          "q": "Which words should describe how the new website feels?",
          "opts": [
            "Calm",
            "Spiritual",
            "Luxurious",
            "Minimal",
            "Warm",
            "Earthy",
            "Modern",
            "Indian heritage",
            "Intimate",
            "Joyful"
          ]
        },
        {
          "id": "founder",
          "type": "one",
          "q": "Would you like the founder’s story on the site with a name and photo?",
          "opts": [
            "Yes, with name and photo",
            "Name only",
            "Keep it anonymous"
          ]
        }
      ]
    },
    {
      "id": "inspo",
      "t": "Inspiration and competitors",
      "d": "What you love, what you don’t, and who you’re compared with. This helps us design something that feels like Aumèra and nobody else.",
      "q": [
        {
          "id": "competitors",
          "type": "long",
          "q": "Which brands do you see as competitors, or do customers compare you with?",
          "hint": "Indian or international, perfume or gifting. Names or links are enough."
        },
        {
          "id": "comp_like",
          "type": "long",
          "q": "What do you like about how those brands present themselves?"
        },
        {
          "id": "comp_differ",
          "type": "long",
          "q": "How is Aumèra different from them?"
        },
        {
          "id": "refs",
          "type": "long",
          "q": "Websites you love the look and feel of, in any category.",
          "hint": "A link and a line on what you like: the colours, photos, layout, how it feels to scroll."
        },
        {
          "id": "refs_dislike",
          "type": "long",
          "q": "Websites or styles you don’t like, or want to avoid.",
          "hint": "For example too loud, too busy, too cheap-looking, too dark."
        },
        {
          "id": "current_keep",
          "type": "long",
          "q": "Anything on your current website you like and want to keep?"
        },
        {
          "id": "current_change",
          "type": "long",
          "q": "Anything on your current website you don’t like?"
        },
        {
          "id": "refs_files",
          "type": "file",
          "q": "Screenshots or mood images you’d like to share."
        }
      ]
    },
    {
      "id": "theon",
      "t": "THEON · for you",
      "d": "Details for the THEON product page.",
      "q": [
        {
          "id": "theon_box",
          "type": "confirm",
          "q": "Inside the THEON box: is this complete?"
        },
        {
          "id": "theon_format",
          "type": "one",
          "q": "Are the THEON oils roll-ons, sprays, or both?",
          "opts": [
            "Roll-on",
            "Spray",
            "Both"
          ]
        },
        {
          "id": "theon_notes",
          "type": "long",
          "q": "What do I Rise, I Create and I Become smell like?",
          "hint": "Top, heart and base notes, or just a few words each, like “warm, woody, a little citrus”."
        },
        {
          "id": "theon_crystals",
          "type": "long",
          "q": "Which crystal goes into each oil?"
        },
        {
          "id": "theon_ritual",
          "type": "one",
          "q": "Should the website explain the Witness marks and the Keeper box ritual?",
          "opts": [
            "Yes, it’s central",
            "Briefly",
            "No, keep it a surprise"
          ]
        },
        {
          "id": "theon_price",
          "type": "one",
          "q": "Should the website keep the current price?",
          "opts": [
            "Yes",
            "We’ll share an updated price"
          ]
        }
      ]
    },
    {
      "id": "soul",
      "t": "Soul Sutras · for loved ones",
      "d": "Details for the Soul Sutras product page.",
      "q": [
        {
          "id": "ss_box",
          "type": "confirm",
          "q": "Inside the Soul Sutras box: is this complete?"
        },
        {
          "id": "ss_scents",
          "type": "long",
          "q": "Which scent(s) are in Soul Sutras, and what do they smell like?"
        },
        {
          "id": "ss_message",
          "type": "one",
          "q": "Can the bookmark carry the customer’s own message?",
          "opts": [
            "Yes, a personal message",
            "We offer set messages",
            "Not yet, but we’d like to"
          ]
        },
        {
          "id": "ss_occasions",
          "type": "many",
          "q": "Which moments should Soul Sutras be shown for?",
          "opts": [
            "Raksha Bandhan",
            "Diwali",
            "Birthdays",
            "Anniversaries",
            "Mother’s / Father’s Day",
            "Friendship",
            "Thank you",
            "Just because"
          ]
        },
        {
          "id": "ss_price",
          "type": "one",
          "q": "Should the website keep the current price?",
          "opts": [
            "Yes",
            "We’ll share an updated price"
          ]
        }
      ]
    },
    {
      "id": "special",
      "t": "What makes Aumèra special",
      "d": "The points the new website will lead with.",
      "q": [
        {
          "id": "usps",
          "type": "many",
          "q": "Which of these should the website highlight most?",
          "opts": [
            "Stays with you (long-lasting)",
            "Made in Kannauj",
            "Handcrafted",
            "Crystal-infused",
            "Plant-based",
            "Alcohol-free",
            "Travel friendly",
            "Eco-friendly packaging",
            "Connects you to your soul"
          ]
        },
        {
          "id": "kannauj",
          "type": "long",
          "q": "Tell us a little about the Kannauj connection.",
          "hint": "Who makes the perfumes and how. Kannauj is India’s perfume capital, a beautiful story to tell."
        },
        {
          "id": "longevity",
          "type": "one",
          "q": "How should we describe how long the fragrance lasts?",
          "opts": [
            "Up to 48 hours",
            "All-day / long-lasting",
            "Something else"
          ]
        },
        {
          "id": "care",
          "type": "long",
          "q": "Anything customers should know about using it? (how to apply, shelf life, skin notes)"
        }
      ]
    },
    {
      "id": "gifts",
      "t": "Gift range and your own box",
      "d": "The soulful gift range and the build-your-own box.",
      "q": [
        {
          "id": "new_now",
          "type": "many",
          "q": "Which new products would you like on the website from day one?",
          "opts": [
            "Candles",
            "5-Minute Journal",
            "Premium flowers",
            "Easel with a custom card",
            "More Soul Memory Perfumes",
            "Show as “coming soon”"
          ]
        },
        {
          "id": "new_about",
          "type": "long",
          "q": "A line about each new product, if you have it.",
          "hint": "What it is, size, scent, anything you know so far."
        },
        {
          "id": "box_items",
          "type": "one",
          "q": "How many products should go into one box?",
          "opts": [
            "3, as discussed",
            "2 or 3",
            "Customer chooses",
            "Let’s discuss"
          ]
        },
        {
          "id": "box_what",
          "type": "many",
          "q": "Which products can customers put in their box?",
          "opts": [
            "Perfume",
            "Candle",
            "Journal",
            "Flowers",
            "Easel + card",
            "Bookmark"
          ]
        },
        {
          "id": "personal",
          "type": "many",
          "q": "What would you like customers to personalise?",
          "opts": [
            "Message card",
            "Receiver’s name",
            "Gift wrap",
            "Hide price on invoice",
            "Delivery date"
          ]
        },
        {
          "id": "packaging",
          "type": "long",
          "q": "How does the gift box look? Share a photo or describe it."
        }
      ]
    },
    {
      "id": "photos",
      "t": "Photos and files",
      "d": "The new design will only be as beautiful as the photos. Upload whatever you have; we’ll suggest what to add.",
      "q": [
        {
          "id": "logo",
          "type": "file",
          "q": "Logo in high quality (AI, SVG or PDF if you have it)."
        },
        {
          "id": "packshots",
          "type": "file",
          "q": "Product photos: each product and each scent."
        },
        {
          "id": "lifestyle",
          "type": "file",
          "q": "Lifestyle photos: in hand, on a table, being gifted."
        },
        {
          "id": "inside_box",
          "type": "file",
          "q": "Unboxing or what’s-inside photos."
        },
        {
          "id": "founder_photo",
          "type": "file",
          "q": "Founder photo, if you’d like it on the site."
        },
        {
          "id": "videos",
          "type": "file",
          "q": "Reels or videos.",
          "hint": "For large videos, a Google Drive link is easiest."
        },
        {
          "id": "shoot",
          "type": "one",
          "q": "Would a product photoshoot help?",
          "opts": [
            "Yes, let’s plan one",
            "Maybe later",
            "We have enough photos"
          ]
        }
      ]
    },
    {
      "id": "shop",
      "t": "Shopping details",
      "d": "So the shop and policy pages are accurate.",
      "q": [
        {
          "id": "delivery",
          "type": "one",
          "q": "Where do you deliver?",
          "opts": [
            "All over India",
            "Selected cities",
            "India and abroad"
          ]
        },
        {
          "id": "cod",
          "type": "one",
          "q": "Do you offer cash on delivery?",
          "opts": [
            "Yes",
            "No",
            "Planning to"
          ]
        },
        {
          "id": "returns",
          "type": "long",
          "q": "How do you handle returns or exchanges?",
          "hint": "A few lines is enough; we’ll write the policy page from it."
        },
        {
          "id": "support",
          "type": "confirm",
          "q": "Are these the right contact details for customers?"
        },
        {
          "id": "whatsapp",
          "type": "one",
          "q": "Should customers be able to reach you on WhatsApp?",
          "opts": [
            "Yes, same number",
            "Yes, different number",
            "No"
          ]
        }
      ]
    },
    {
      "id": "presence",
      "t": "Social and reviews",
      "d": "Where people can find Aumèra, and what they say about it.",
      "q": [
        {
          "id": "handles",
          "type": "long",
          "q": "Your social media links.",
          "hint": "Instagram, Facebook, LinkedIn, YouTube. Just paste them."
        },
        {
          "id": "reviews",
          "type": "file",
          "q": "Customer messages, reviews or screenshots you’re happy for us to show."
        },
        {
          "id": "reviews_text",
          "type": "long",
          "q": "Or paste a few here, with first name and city."
        },
        {
          "id": "press",
          "type": "long",
          "q": "Any features, events, pop-ups or collaborations worth mentioning?"
        }
      ]
    },
    {
      "id": "else",
      "t": "Anything else",
      "d": "Last bits.",
      "q": [
        {
          "id": "drive",
          "type": "text",
          "q": "A shared folder link for everything else (Google Drive or Dropbox)."
        },
        {
          "id": "contact",
          "type": "text",
          "q": "Who should we coordinate with for content and website access?"
        },
        {
          "id": "anything",
          "type": "long",
          "q": "Anything you’d love the new website to have or to feel like?"
        }
      ]
    }
  ],
};
