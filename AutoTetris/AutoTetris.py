import pygame # 1. pygame 선언
import random

pygame.init() # 2. pygame 초기화

# 3. pygame에 사용되는 전역변수 선언

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
size = [600, 800]
screen = pygame.display.set_mode(size)

done = False
clock = pygame.time.Clock()

# 4. pygame 무한루프
def runGame():
    global done
    while not done:
        screen.fill(BLACK)
        pygame.display.update()
        screen.fill(WHITE)
        pygame.display.update()
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                done=True
        
        #pygame.display.update()

runGame()
pygame.quit()