# MISSION.md: Ranatrasken Digital Stampcard & Route Guide

## Goal
Develop a high-performance web application to guide hikers participating in the Ranatrasken initiative. The app will provide detailed route information, including terrain elevation, parking spots, and suitability for children, while offering a digital "stampcard" to track visits.

## Tech Stack
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Vanilla CSS (Optimized for speed)
- **Mapping**: MapLibre GL JS (Open Source)
- **Terrain**: MapTiler (Free tier, no CC)
- **Map Data**: Kartverket Topo4 (Official Norwegian data)

## Non-Goals
- Real-time GPS navigation (offline support is a plus, but active turn-by-turn is out of scope for MVP).
- Social networking features (comments, photo sharing) beyond simple activity tracking.
- E-commerce for physical stampcards (focus on digital tracking).

## Core Entities
- **Destination**: Name, Lat/Long, Difficulty, Elevation Profile, Child-friendliness rating.
- **Route**: GPX-style coordinate list, Parking start point.
- **User**: Profile, Visit History (Stamped destinations).
