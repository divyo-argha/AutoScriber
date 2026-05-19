# Quick Start Guide: Thematic Analysis

## 🚀 Getting Started in 3 Steps

### Step 1: Start the Application

```bash
cd /Users/bobdylan/Desktop/autoScribe-4
npm run dev
```

Open your browser to `http://localhost:3000`

### Step 2: Navigate to Thematic Analysis

Click the **"Analysis"** button in the header (Brain icon 🧠)

### Step 3: Upload & Analyze

1. **Upload transcripts**: Click "Choose Files" or drag-and-drop
   - Use the provided test files: `test-transcript-1.txt` and `test-transcript-2.txt`
   
2. **Add research question** (optional):
   ```
   How do users experience mobile app accessibility and usability?
   ```

3. **Click "Start Analysis"** and wait 10-30 seconds

4. **Explore results**:
   - Click on themes to expand
   - View codes and supporting quotes
   - Check frequency and prevalence metrics

5. **Export results**:
   - Click "JSON" for structured data
   - Click "CSV" for spreadsheet analysis

## 📊 What You'll See

### Example Output Structure

```
Theme: Navigation Difficulties (75% prevalence)
├─ Code: Confusing Menu Structure (3 occurrences)
│  └─ Quote: "Too many options, too many menus. আমি হারিয়ে যাই."
│     Source: test-transcript-1.txt
├─ Code: Unclear User Flow (2 occurrences)
│  └─ Quote: "When I open an app, I don't know where to go."
│     Source: test-transcript-1.txt
└─ Code: Complex Registration Process (2 occurrences)
   └─ Quote: "The registration process was very complicated."
      Source: test-transcript-2.txt
```

## 🎯 Use Cases

### For HCI Researchers
- Analyze user interview transcripts
- Identify usability patterns
- Extract accessibility issues
- Generate initial codebook

### For UX Researchers
- Process user feedback sessions
- Identify pain points
- Discover user needs
- Support design decisions

### For Academic Research
- Qualitative data analysis
- Grounded theory studies
- Phenomenological research
- Case study analysis

## ⚠️ Important Notes

### This is an Assistant Tool
- **Not a replacement** for researcher judgment
- **Requires validation** and interpretation
- **Starting point** for analysis, not final output
- **Transparent process** - all reasoning visible

### Best Practices
1. ✅ Review all generated codes and themes
2. ✅ Validate quotes against original transcripts
3. ✅ Refine theme names and descriptions
4. ✅ Add your own interpretive layer
5. ✅ Export and validate in NVivo/MAXQDA
6. ✅ Document AI-assisted methodology in papers

### When to Use
- ✅ Large datasets (10+ interviews)
- ✅ Initial coding phase
- ✅ Pattern identification
- ✅ Time-constrained projects
- ✅ Exploratory research

### When NOT to Use Alone
- ❌ Final analysis without validation
- ❌ High-stakes research decisions
- ❌ Publication without review
- ❌ Replacing researcher expertise
- ❌ Sensitive/confidential data (without precautions)

## 🔧 Troubleshooting

### "GEMINI_API_KEY not configured"
Check `.env.local` file has:
```env
GEMINI_API_KEY=your_key_here
```

### "Analysis failed"
- Check file format (plain text only)
- Ensure files are not empty
- Try with fewer files first
- Check API key is valid

### "Parse error"
- This is rare - the system has robust fallbacks
- Try again (Gemini responses can vary)
- Check console for details

### Slow analysis
- Normal for 5+ interviews
- Each interview adds ~5-10 seconds
- Maximum timeout: 5 minutes

## 📈 Next Steps

After getting results:

1. **Review & Refine**
   - Read through all themes
   - Check if codes make sense
   - Verify quotes are relevant

2. **Export & Validate**
   - Download JSON for structured data
   - Download CSV for spreadsheet analysis
   - Import into NVivo/MAXQDA for validation

3. **Iterate**
   - Run analysis with different research questions
   - Compare results across datasets
   - Refine your interview questions

4. **Document**
   - Note that AI was used for initial coding
   - Describe validation process
   - Cite methodology (Braun & Clarke)

## 📚 Methodology Reference

This tool implements:
- **Braun & Clarke (2006)** thematic analysis
- **Inductive coding** approach
- **Semantic themes** (explicit meanings)
- **Qualitative rigor** with transparency

### Citation Suggestion

```
Initial thematic coding was performed using AI-assisted analysis 
(Gemini 2.5 Flash) following Braun & Clarke's (2006) methodology. 
All codes and themes were subsequently reviewed, validated, and 
refined by the research team.
```

## 🎓 Learning Resources

- Braun & Clarke (2006): "Using thematic analysis in psychology"
- Saldaña (2015): "The Coding Manual for Qualitative Researchers"
- Guest et al. (2011): "Applied Thematic Analysis"

## 💡 Tips for Better Results

1. **Clear transcripts**: Clean, well-formatted text
2. **Context matters**: Add research question for focus
3. **Multiple interviews**: Better patterns with 3+ transcripts
4. **Mixed language**: Works with Bangla/English mix
5. **Iterate**: Try different research questions

## ✅ Success Checklist

Before publishing research using this tool:

- [ ] Reviewed all generated codes
- [ ] Validated themes against data
- [ ] Refined descriptions and names
- [ ] Checked quote accuracy
- [ ] Exported for external validation
- [ ] Documented AI-assisted process
- [ ] Added researcher interpretation
- [ ] Cited methodology properly

---

**Ready to analyze?** Upload your transcripts and discover patterns! 🔍
