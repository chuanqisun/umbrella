# YouSan

An umbrella that remembers those who walked beside you

_You San_ is an interactive object that explores how everyday artifacts might become vessels for emotional presence and memory. Designed as an umbrella that “remembers” the experience of walking in the rain with someone, the system records ambient rain audio when two people simultaneously hold the umbrella handle. The heat pattern of the second person’s hand is also captured. When users later grasp the handle alone, a small projector recreates the remembered moment by projecting a heat-map visualization representing the absent partner’s thermal signature beneath the canopy, paired with the recorded sound of rain. We frame _You San_ as an exploration of teleabsence—how technology might evoke the felt presence of someone no longer physically there. We describe our low-fidelity prototype and the design motivations behind embedding memory into mundane objects. We discuss design implications for emotional HCI, embodied recall, and ambient intimate computing.

**CCS CONCEPTS •** Human-centered computing • Interaction design • Ubiquitous and mobile computing systems and tools

**Additional Keywords and Phrases:** Teleabsence, Tangible interaction, Memory

## Introduction

Many emotionally meaningful interactions take place not through explicit communication but through subtle, shared experiences in everyday environments. Walking together under an umbrella during rainfall is one such moment—quiet, intimate, and embodied. Yet such experiences fade quickly and are rarely captured by technologies designed for explicit communication or documentation.

Recent HCI research has explored presence-at-a-distance, tangible memory cues, and computational objects that support emotional connection. However, the emotional residue of everyday experiences remains underexplored. We draw on the concept of **teleabsence**: the sense of presence that arises from the ambient traces someone leaves behind, even when they are physically absent.

_Umbra Echo_ investigates how a familiar object might subtly preserve and replay such embodied traces. Rather than focusing on communication channels or data-centric representations, we explore how an ordinary umbrella can become a medium for evoking the memory of someone’s presence through sound, heat, and touch-based interaction.

## Related work

1.  **MirrorFugue**
2.  **Tangible Interaction**

## Methodologies

### Overview

The design aims to create a sense of virtual presence when one person is physically absent, achieved through an iterative interaction between the users and the umbrella. The umbrella consists of an input and an output. The inputs include two heat sensors to detect the presence of people, two pressure sensors that detect how many hands are holding the umbrella and also act as a mode switch, and a microphone to record sound. The outputs include a fisheye lens projector that projects the absent person’s heat map and a speaker that plays the processed ambient sound of when the absent person was present.

The performative umbrella consists of three modes in response to users’ input: present mode, idle mode, and absent mode.

- Present mode is on when two people stand under the umbrella and hold it together (heat sensor \= 2, pressure sensor \= 2). When both the heat and pressure sensors detect their presence in this mode, the pressure sensors will act as a trigger for the microphone and computer to start to record audio and capture dynamic heat patterns in real time.
- If one person removes their hand from the sensor, the microphone stops recording. When that person fully leaves the umbrella, the umbrella returns to its common mode (pressure sensor ≠ 2).
- However, if one person remains under the umbrella (heat sensor \= 1\) and holds the umbrella with both hands (pressure sensor \= 2), the umbrella enters the absent mode. In this mode, the umbrella projects the most recent processed recording of the ambient sound with an animated heat map representing that person’s sound waves and temperature at the moment they were present the last time.

|              | Heat sensor number | Pressure sensor number | microphone | Projector \+ speaker |
| :----------: | :----------------: | :--------------------: | :--------: | :------------------: |
| Present mode |         2          |           2            |     on     |         off          |
|  Idle mode   |        N/A         |          ≠ 2           |    off     |         off          |
| Absent mode  |         1          |           2            |    off     |          on          |

### Hardware

### Software

### Discussion

### Conclusion

### Future work
