#!/bin/bash
# ════════════════════════════════════════════════════════
#  ExamFlow — AWS S3 Deployment Script
#  KLH University · BCA Final Year Project 2026
#  Author: Tankthireddy (2320520034)
# ════════════════════════════════════════════════════════

# ── CONFIGURATION ── (Change these values!)
BUCKET_NAME="examflow-klh-university-2026"
REGION="ap-south-1"          # India/Mumbai
SOURCE_DIR="."                # Current folder = project root
INDEX_DOC="index.html"
ERROR_DOC="error.html"
CLOUDFRONT_ID=""              # Fill after CloudFront creation

# ── COLORS ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  🚀 ExamFlow — AWS S3 Deploy Script${NC}"
echo -e "${CYAN}  KLH University · BCA 2026${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo ""

# ── CHECK AWS CLI ──
echo -e "${BLUE}[1/6]${NC} Checking AWS CLI..."
if ! command -v aws &>/dev/null; then
  echo -e "${RED}❌ AWS CLI not installed!${NC}"
  echo "   Install from: https://aws.amazon.com/cli/"
  echo "   Or run: pip install awscli"
  exit 1
fi
echo -e "${GREEN}✓ AWS CLI found: $(aws --version 2>&1 | head -1)${NC}"

# ── CHECK CREDENTIALS ──
echo ""
echo -e "${BLUE}[2/6]${NC} Checking AWS credentials..."
if ! aws sts get-caller-identity &>/dev/null; then
  echo -e "${YELLOW}⚠️  AWS credentials not configured.${NC}"
  echo "   Run: aws configure"
  echo "   You need: Access Key ID + Secret Access Key"
  exit 1
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ Logged in as Account: $ACCOUNT_ID${NC}"

# ── CREATE BUCKET ──
echo ""
echo -e "${BLUE}[3/6]${NC} Creating S3 bucket: ${YELLOW}$BUCKET_NAME${NC}"
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Bucket created!${NC}"
else
  echo -e "${YELLOW}ℹ Bucket may already exist. Continuing...${NC}"
fi

# ── CONFIGURE WEBSITE HOSTING ──
echo ""
echo -e "${BLUE}[4/6]${NC} Configuring static website hosting..."

# Remove public access block
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
  BlockPublicAcls=false,IgnorePublicAcls=false,\
BlockPublicPolicy=false,RestrictPublicBuckets=false

# Enable website hosting
aws s3api put-bucket-website \
  --bucket "$BUCKET_NAME" \
  --website-configuration "{
    \"IndexDocument\":{\"Suffix\":\"$INDEX_DOC\"},
    \"ErrorDocument\":{\"Key\":\"$ERROR_DOC\"}
  }"

# Apply public read bucket policy
aws s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --policy "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Sid\":\"PublicReadGetObject\",
      \"Effect\":\"Allow\",
      \"Principal\":\"*\",
      \"Action\":\"s3:GetObject\",
      \"Resource\":\"arn:aws:s3:::$BUCKET_NAME/*\"
    }]
  }"

echo -e "${GREEN}✓ Website hosting configured!${NC}"

# ── UPLOAD FILES ──
echo ""
echo -e "${BLUE}[5/6]${NC} Uploading ExamFlow files to S3..."
echo ""

aws s3 sync "$SOURCE_DIR" "s3://$BUCKET_NAME/" \
  --delete \
  --exclude ".git/*" \
  --exclude "*.DS_Store" \
  --exclude "node_modules/*" \
  --exclude "*.sh" \
  --exclude "*.md" \
  --exclude ".github/*" \
  --content-type "text/html" \
  --metadata-directive "REPLACE" \
  2>&1 | grep -E "upload:|delete:" | head -30

echo ""
echo -e "${GREEN}✓ All files uploaded!${NC}"

# ── CLOUDFRONT (OPTIONAL) ──
echo ""
echo -e "${BLUE}[6/6]${NC} CloudFront cache invalidation..."
if [ -n "$CLOUDFRONT_ID" ]; then
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_ID" \
    --paths "/*" &>/dev/null
  echo -e "${GREEN}✓ CloudFront cache cleared!${NC}"
else
  echo -e "${YELLOW}ℹ Skipping CloudFront (set CLOUDFRONT_ID to enable)${NC}"
fi

# ── DONE ──
echo ""
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ ExamFlow Deployment COMPLETE!${NC}"
echo ""
echo -e "${CYAN}🌐 Your ExamFlow URLs:${NC}"
echo -e "   S3 Website:  http://$BUCKET_NAME.s3-website.$REGION.amazonaws.com"
echo -e "   S3 Direct:   https://$BUCKET_NAME.s3.$REGION.amazonaws.com/index.html"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo -e "   1. Visit the URL above to confirm it's live"
echo -e "   2. Set up CloudFront for HTTPS + global CDN"
echo -e "   3. Add custom domain in Route 53"
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo ""