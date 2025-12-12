**You San**  
An umbrella that remembers those who walked beside you

_You San_ is an interactive object that explores how everyday artifacts might become vessels for emotional presence and memory. Designed as an umbrella that “remembers” the experience of walking in the rain with someone, the system records ambient rain audio when two people simultaneously hold the umbrella handle. The heat pattern of the second person’s hand is also captured. When users later grasp the handle alone, a small projector recreates the remembered moment by projecting a heat-map visualization representing the absent partner’s thermal signature beneath the canopy, paired with the recorded sound of rain. We frame _You San_ as an exploration of teleabsence—how technology might evoke the felt presence of someone no longer physically there. We describe our low-fidelity prototype and the design motivations behind embedding memory into mundane objects. We discuss design implications for emotional HCI, embodied recall, and ambient intimate computing.

**CCS CONCEPTS •** Human-centered computing • Interaction design • Ubiquitous and mobile computing systems and tools

**Additional Keywords and Phrases:** _Teleabsence, Tangible interaction, Memory, Thermal Experience_

1. Introduction

Many emotionally meaningful interactions take place not through explicit communication but through subtle, shared experiences in everyday environments. Walking together under an umbrella during rainfall is one such moment—quiet, intimate, and embodied. Yet such experiences fade quickly and are rarely captured by technologies designed for explicit communication or documentation.

Recent HCI research has explored presence-at-a-distance, tangible memory cues, and computational objects that support emotional connection. However, the emotional residue of everyday experiences remains underexplored. We draw on the concept of **teleabsence**: the sense of presence that arises from the ambient traces someone leaves behind, even when they are physically absent.

_You San_ investigates how a familiar object might subtly preserve and replay such embodied traces. Rather than focusing on communication channels or data-centric representations, we explore how an ordinary umbrella can become a medium for evoking the memory of someone’s presence through sound, heat, and touch-based interaction.

2. Related Works

**2.1 MirrorFugue**  
MirrorFugue offers a compelling precedent for exploring teleabsence through embodied performance. By combining a player piano’s moving keys with life-sized projections of a pianist’s hands and upper body, MirrorFugue “conjures” the performer’s presence and enables audiences to experience recorded performances as if a virtual body were physically co-present. The system blends figurative audiovisual projection with the disembodied mechanical motion of the piano, creating a hybrid presence that participants often described as immersive and emotionally resonant. Xiao et al.\[1\] articulate how such a composite interface allows viewers to viscerally sense the performer “as if they were sitting beside me,” demonstrating that subtle synchronization of body cues and physical actuation can powerfully evoke the presence of an absent other. Earlier work further frames MirrorFugue as part of a broader design agenda to bring embodied musical expression back into digitally mediated experiences, showing how projected gestures and synchronized motion can bridge temporal and spatial separation in ways that foreground affect, intimacy, and corporeal nuance. For _You San_, MirrorFugue provides a conceptual foundation: both systems capture fleeting embodied traces (hand posture, gesture, presence cues) and replay them as evocative performances.

**2.2 Thermal Experiences**

Moesgen’s exploration of thermal experience design highlights how temperature is not merely a physiological signal but a rich experiential material capable of evoking emotion, memory, and embodied meaning. In his TEI ’24 work, Moesgen argues that thermal stimuli can produce sensations ranging from relaxation and nostalgia to vitality, and he critiques the over-emphasis on technical implementation in prior thermal-feedback systems, calling instead for deeper engagement with the aesthetic, phenomenological, and tacit qualities of heat in interaction design. Drawing from sauna-based phenomenological interviews, he identifies nuanced experiential parameters—such as motion, timbre, and distribution—that shape how people perceive and interpret heat. This position aligns closely with our use of thermal traces as evocative memory cues in _You San_. While Moesgen’s work focuses on understanding and crafting thermal sensations themselves, our project applies similar insights to represent the lingering presence of another person through a projected thermal imprint. His framing of heat as an affective and expressive medium supports the idea that thermal cues can communicate emotional content, intimacy, and atmospheric qualities, reinforcing our use of heat-map projection as a subtle, embodied form of teleabsence and interpersonal memory.

3. ## **Methodology**

## **3.1 Overview**

The design aims to create a sense of virtual presence when one person is physically absent, achieved through an iterative interaction between the users and the umbrella. The umbrella consists of an input and an output. The inputs include two heat sensors to detect the presence of people, two pressure sensors that detect how many hands are holding the umbrella and also act as a mode switch, and a microphone to record sound. The outputs include a fisheye lens projector that projects the absent person’s heat map and a speaker that plays the processed ambient sound of when the absent person was present.

![][image1]

The performative umbrella consists of three modes in response to users’ input: present mode, idle mode, and absent mode.

- Present mode is on when two people stand under the umbrella and hold it together (heat sensor \= 2, pressure sensor \= 2). When both the heat and pressure sensors detect their presence in this mode, the pressure sensors will act as a trigger for the microphone and computer to start to record audio and capture dynamic heat patterns in real time.
- If one person removes their hand from the sensor, the microphone stops recording. When that person fully leaves the umbrella, the umbrella returns to its common mode (pressure sensor ≠ 2).
- However, if one person remains under the umbrella (heat sensor \= 1\) and holds the umbrella with both hands (pressure sensor \= 2), the umbrella enters the absent mode. In this mode, the umbrella projects the most recent processed recording of the ambient sound with an animated heat map representing that person’s sound waves and temperature at the moment they were present the last time.

|              | Heat sensor number | Pressure sensor number | microphone | Projector \+ speaker |
| :----------: | :----------------: | :--------------------: | :--------: | :------------------: |
| Present mode |         2          |           2            |     on     |         off          |
|  Idle mode   |        N/A         |          ≠ 2           |    off     |         off          |
| Absent mode  |         1          |           2            |    off     |          on          |

## **3.2 Hardware**

_This submission version of your paper should not have headers or footers; these will be added when your manuscript is processed after acceptance. It should remain in a one-column format—please do not alter any of the styles or margins._  
_If a paper is accepted for publication, authors will be instructed on the next steps. Authors must then follow the submission instructions found on their respective publication’s web page. Once your submission is received, your paper will be processed to produce the formatted Word, PDF, and HTML5 output formats, which will be provided to you for review, revision/resubmission (if applicable), and approval._  
_This submission template allows authors to submit their papers for review to an ACM Conference or Journal without any output design specifications incorporated at this point in the process. The ACM “Submission Template” is a single column MS-Word document that allows authors to type their content into the pre-existing set of paragraph formatting styles applied to the sample placeholder text here, or copy-and-paste their text and then apply the respective paragraph styles (**Windows**: you can open the Styles task pane from the **Home** tab \[it can also be opened with the keyboard shortcut Alt+Ctrl+Shift+S\]; **MAC16**: you can access the Styles pane at the right of the **Home** toolbar.) Highlight a section that you want to designate with a certain style, and then select the appropriate style from the list. To view which style is being used in any part of this document, place your cursor on your text and look at the “Current style” field in the Styles pane._

## **3.3 Software**

_This submission version of your paper should not have headers or footers, these will be added when your manuscript is processed after acceptance. It should remain in a one-column format—please do not alter any of the styles or margins._  
_If a paper is accepted for publication, authors will be instructed on the next steps. Authors must then follow the submission instructions found on their respective publication’s web page. Once your submission is received, your paper will be processed to produce the formatted Word, PDF, and HTML5 output formats, which will be provided to you for review, revision/resubmission (if applicable), and approval._  
_It is beneficial to create your document in draft mode with the style panel open in the left-side panel. If the panel is not immediately visible when the Submission Template is opened, you will need to open the panel manually—for Windows: click on the following from the main ribbon above: File \> Options \> Advanced \> Display \> Style area pane width in Draft and Outline views. Set the style area width (1–1.5" is a good starting value.); for MAC: go to the “**View**” menu and select “**Draft**”; then go to the “**Word**” menu and select “**Preferences**” and then “**View**,” under the “**Window**” section insert “1.5” inches under the style area width._  
_All style elements are specified in this template to facilitate the production of your paper and to have the styles consistent throughout. The paragraph styles are built-in and examples of the styles are provided throughout this document. Save as you go and backup your work regularly\!_

4. Discussion and Conclusion

You San demonstrates how ordinary objects can be transformed into vessels for affective memory rather than channels of direct communication. By embedding sensors, projection, and audio in a redesigned umbrella, the project shifts emphasis from information transmission to the felt residue of shared experience. You San also highlights the temporal dimension of HCI. Unlike synchronous telepresence systems, it operates an asynchronous embodiment.

This mode supports reflective remembering, suggesting opportunities to help users re-encounter past moments through touching, seeing, and hearing. It prioritizes emotional resonance over informational fidelity. Participants described the projection of a partner’s heat signature as recalling and nostalgia. Such teleabsence invites reflection on one’s feelings rather than dialogue, suggesting designs can be a meaningful aesthetic state that preserves longing, memory, and imagination.

5. Future Works

A future direction for extending You San is integrating location awareness to trigger memory playback. Human memory is inherently spatial. Certain streets, corners, or environments spontaneously evoke past moments. Embedding location sensing into the system would be: when a user walks past a memorizable location with both hands on the handle, the system activates the stored trace associated with that place. This feature layer episodic memory cues atop the existing thermal and acoustic traces, creating an interaction model closer to how people naturally remember with contextual associations. passing through the entrance of a café where two people once shared an umbrella could trigger a soft replay of rain sounds or a faint projection of the companion’s thermal imprint.

Future iterations will explore how to tune the sensitivity of location triggers based on respectful user consent and contextual appropriateness. This direction opens new possibilities for situated teleabsence, where memory becomes not just stored and replayed, but re-encountered in the environments that first shaped it.

# **Reference**

1. Xiao Xiao and Hiroshi Ishii. 2016\. Inspect, Embody, Invent: A Design Framework for Music Learning and Beyond. In Proceedings of the 2016 CHI Conference on Human Factors in Computing Systems (CHI '16), Santa Clara, California, USA. ACM, New York, NY, USA, pp. 5397–5408. https://doi.acm.org/10.1145/2858036.2858577

2. Tim Moesgen. 2024\. Understanding and Designing Thermal Experiences. In Eighteenth International Conference on Tangible, Embedded, and Embodied Interaction (TEI '24), February 11–14, 2024, Cork, Ireland. ACM, New York, NY, USA, 4 pages. https://doi.org/10.1145/3623509.3634893
