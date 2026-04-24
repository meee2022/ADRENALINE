// script/importPublicMeals.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGES_DIR = path.join(__dirname, "..", "meals-images");
const convexUrl = process.env.CONVEX_URL || "https://rightful-parakeet-660.convex.cloud";
const client = new ConvexHttpClient(convexUrl);

function toSlug(nameEn: string) {
  return nameEn
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function uploadImage(imagePath: string): Promise<string> {
  try {
    console.log(`   ⬆️  Uploading to Convex storage...`);
    
    // 1. Generate upload URL
    const uploadUrl = await client.mutation(api.files.generateUploadUrl, {});

    // 2. Read file as Buffer
    const imageBuffer = fs.readFileSync(imagePath);

    // 3. Upload to Convex
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: imageBuffer,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const { storageId } = await response.json();

    // 4. Return storageId only (NOT URL)
    console.log(`   ✅ Uploaded: ${storageId}`);
    return storageId;
  } catch (error) {
    console.error(`   ❌ Upload error:`, error);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting meal import with Convex storage...");
  console.log(`📁 Images directory: ${IMAGES_DIR}`);

  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`❌ Images directory not found: ${IMAGES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(IMAGES_DIR).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
  console.log(`📸 Found ${files.length} images`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      const basename = path.basename(file, path.extname(file));
      
      // Find the first Arabic character
      const arabicMatch = basename.match(/[\u0600-\u06FF]/);
      
      let nameEn: string;
      let nameAr: string;
      
      if (arabicMatch && arabicMatch.index !== undefined) {
        // Find the last space before the Arabic text starts
        const beforeArabic = basename.substring(0, arabicMatch.index);
        const lastSpaceIndex = beforeArabic.lastIndexOf(' ');
        
        if (lastSpaceIndex > 0) {
          nameEn = basename.substring(0, lastSpaceIndex).trim();
          nameAr = basename.substring(lastSpaceIndex + 1).trim();
        } else {
          // No space found, use the whole string
          nameEn = basename.trim();
          nameAr = basename.trim();
        }
      } else {
        // No Arabic found
        nameEn = basename.trim();
        nameAr = basename.trim();
      }

      const slug = toSlug(nameEn);

      console.log(`\n📤 [${successCount + 1}/${files.length}] ${file}`);
      console.log(`   EN: ${nameEn}`);
      console.log(`   AR: ${nameAr}`);
      console.log(`   Slug: ${slug}`);

      // Upload image and get storageId
      const imagePath = path.join(IMAGES_DIR, file);
      const storageId = await uploadImage(imagePath);

      // Guess category
      const lowerName = nameEn.toLowerCase();
      let category: "breakfast" | "lunch" | "dinner" | "salad" | "snack" = "lunch";
      
      if (lowerName.includes("breakfast") || lowerName.includes("pancake") || 
          lowerName.includes("croissant") || lowerName.includes("egg")) {
        category = "breakfast";
      } else if (lowerName.includes("salad") || nameAr.includes("سلطة")) {
        category = "salad";
      } else if (lowerName.includes("snack") || lowerName.includes("ball") || 
                 lowerName.includes("pudding")) {
        category = "snack";
      }

      // Create meal with storageId
      await client.mutation(api.publicMeals.create, {
        nameAr,
        nameEn,
        slug,
        storageId, // Use storageId instead of imageUrl
        calories: 350,
        protein: 30,
        carbs: 25,
        fats: 15,
        category,
        tags: ["وجبة صحية", "طازج"],
        ingredients: [],
        priceQAR: 45,
        sortOrder: 999,
        isActive: true,
      });

      console.log(`   ✅ Created meal successfully`);
      successCount++;
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n🎉 Import complete!`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
